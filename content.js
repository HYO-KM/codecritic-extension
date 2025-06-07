// GitHubのURLからPR情報を取得する関数
function getPRInfoFromURL() {
  const match = window.location.pathname.match(/\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    pullNumber: match[3]
  };
}

// GitHubのPRにコメントを投稿する関数
async function postCommentToPR(owner, repo, pullNumber, commentBody, githubToken) {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${pullNumber}/comments`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      body: commentBody
    })
  });

  if (response.ok) {
    alert("PRにコメントを投稿しました！");
  } else {
    const err = await response.json();
    console.error("コメント投稿失敗", err);
    alert("投稿に失敗しました: " + (err.message || '不明なエラー'));
  }
}


async function getPRDiff(owner, repo, pullNumber, githubToken) {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}.diff`; // .diff を指定することで差分を取得

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3.diff', // Diff形式をリクエスト
      }
    });

    if (!response.ok) {
      console.error("GitHub Diff取得失敗:", await response.text());
      alert("PRの差分取得に失敗しました。GitHubトークンが正しいか、権限があるか確認してください。");
      return null;
    }

    const diffText = await response.text(); // テキスト形式で差分を取得
    console.log("GitHub APIから取得した差分:", diffText);
    return diffText;
  } catch (error) {
    console.error("ネットワークまたはGitHub API呼び出しエラー:", error);
    alert("GitHub APIから差分取得中にエラーが発生しました。ネットワーク接続を確認してください。");
    return null;
  }
}

// Gemini APIを使用してレビューコメントを生成する関数
async function generateReviewComment(diffText, apiKey) {

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`; // ★変更点: GeminiのエンドポイントとAPIキーをURLに含める

  const promptText = `
あなたはプロのソフトウェアエンジニアです。以下はGitHubのPull Requestの差分です。
この変更に対してレビューコメントをいくつか日本語で出してください。
具体的に改善点・バグ・設計の問題があれば挙げてください。
コードの品質向上に役立つ具体的な指摘を心がけてください。

--- 差分ここから ---
${diffText}
--- 差分ここまで ---
`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        
        contents: [
          {
            role: 'user',
            parts: [
              { text: promptText }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
        },
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini APIエラー:", errorData);
      alert("レビュー生成に失敗しました: " + (errorData.error?.message || '不明なエラー'));
      return;
    }

    const data = await response.json();
    // Gemini APIのレスポンスからコメントを取得する方法
    const comment = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!comment) {
      console.warn("Gemini APIからコメントが取得できませんでした。", data);
      alert("AIコメントの生成に失敗しました。AIの返答が空か、期待する形式ではありませんでした。");
      return;
    }

    console.log("AIレビューコメント:", comment);
    return comment;
  } catch (error) {
    console.error("ネットワークまたはAPI呼び出しエラー:", error);
    alert("レビュー生成中にエラーが発生しました。ネットワーク接続を確認してください。");
    return;
  }
}


async function displayCommentModal(aiComment, prOwner, prRepo, prPullNumber, githubToken) {
  const modalOverlay = document.getElementById('codecritic-modal-overlay');
  const commentTextarea = document.getElementById('codecritic-comment-textarea');
  const postButton = document.getElementById('codecritic-post-button');
  const cancelButton = document.getElementById('codecritic-cancel-button');

  commentTextarea.value = aiComment;
  modalOverlay.style.display = 'flex';

  postButton.onclick = async () => {
    const finalComment = commentTextarea.value;
    await postCommentToPR(prOwner, prRepo, prPullNumber, finalComment, githubToken);
    modalOverlay.style.display = 'none'; 
  };

  // 「キャンセル」ボタンがクリックされたときの処理
  cancelButton.onclick = () => {
    modalOverlay.style.display = 'none';
  };
}



// GitHubページにAIレビューボタンを追加する関数
function addReviewButton() {
  // 既にボタンがある場合は処理しない
  if (document.getElementById('codecritic-review-button')) return;

  const target = document.querySelector('.gh-header-actions');
  if (!target) return;

  const button = document.createElement('button');
  button.id = 'codecritic-review-button';
  button.innerText = 'AIレビュー生成';
  button.className = 'btn btn-sm';
  button.style.marginLeft = '10px';

  button.onclick = async () => {
    // PR情報を取得
    const prInfo = getPRInfoFromURL();
    if (!prInfo) {
      alert("PR情報がURLから取得できませんでした。");
      return;
    }

    const storedData = await new Promise((resolve) => {
      chrome.storage.local.get(['geminiApiKey', 'githubToken'], resolve);
    });

    const geminiApiKey = storedData.geminiApiKey;
    const githubToken = storedData.githubToken;

    if (!geminiApiKey) {
      alert("Gemini APIキーが設定されていません。");
      return;
    }
    if (!githubToken) {
      alert("GitHub Personal Access Tokenが設定されていません。");
      return;
    }

    const diffText = await getPRDiff(prInfo.owner, prInfo.repo, prInfo.pullNumber, githubToken);
    if (!diffText) {
      return; 
    }

    const aiComment = await generateReviewComment(diffText, geminiApiKey);
    if (!aiComment) {
      return;
    }

    displayCommentModal(aiComment, prInfo.owner, prInfo.repo, prInfo.pullNumber, githubToken);
  };

  target.appendChild(button);

  if (!document.getElementById('codecritic-modal-overlay')) {
    const modalHTML = `
      <div id="codecritic-modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: none; justify-content: center; align-items: center; z-index: 9999;">
        <div id="codecritic-modal-content" style="background: white; padding: 20px; border-radius: 8px; width: 600px; max-width: 90%; box-shadow: 0 4px 8px rgba(0,0,0,0.2);">
          <h3 style="margin-top: 0;">AIレビューコメントの確認・編集</h3>
          <textarea id="codecritic-comment-textarea" style="width: 100%; height: 200px; margin-bottom: 15px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; resize: vertical; font-size: 1em;"></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button id="codecritic-post-button" style="background-color: #28a745; color: white; padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer;">GitHubに投稿</button>
            <button id="codecritic-cancel-button" style="background-color: #dc3545; color: white; padding: 8px 15px; border: none; border-radius: 4px; cursor: pointer;">キャンセル</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
}

// 差分表示が読み込まれるのを監視してボタン追加
const observer = new MutationObserver(() => {
  const diffContent = document.querySelector('.js-file-content .blob-code-inner');
  if (diffContent) {
    addReviewButton();
    observer.disconnect(); // ボタンが追加されたら監視を停止
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// PRテストを行います。