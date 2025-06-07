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

// GitHubページにAIレビューボタンを追加する関数
function addReviewButton() {
  if (document.getElementById('codecritic-review-button')) return;

  const target = document.querySelector('.gh-header-actions');
  if (!target) return;

  const button = document.createElement('button');
  button.id = 'codecritic-review-button';
  button.innerText = 'AIレビュー生成';
  button.className = 'btn btn-sm';
  button.style.marginLeft = '10px';

  button.onclick = async () => {
    // まずPR情報を取得
    const prInfo = getPRInfoFromURL();
    if (!prInfo) {
      alert("PR情報がURLから取得できませんでした。");
      return;
    }

    // ★GitHubトークンの取得（ストレージからの取得に置き換える前の暫定措置）★
    const githubToken = prompt("GitHubのPersonal Access Tokenを入力してください（開発用）");
    if (!githubToken) {
      alert("GitHubトークンが入力されませんでした。");
      return;
    }

    // ★変更点: GitHub APIから差分テキストを取得する★
    // .js-file-content .blob-code-inner からのDOM取得は不要になります
    const diffText = await getPRDiff(prInfo.owner, prInfo.repo, prInfo.pullNumber, githubToken);
    if (!diffText) {
      // getPRDiff内でエラーメッセージが表示されているのでここではreturnのみ
      return;
    }

    // ★Gemini APIキーの取得（ストレージからの取得に置き換える前の暫定措置）★
    const geminiApiKey = prompt("Gemini APIキーを入力してください（開発用）");
    if (!geminiApiKey) {
      alert("Gemini APIキーが入力されませんでした。");
      return;
    }

    // AIレビュー生成
    const aiComment = await generateReviewComment(diffText, geminiApiKey);
    if (!aiComment) {
      return;
    }

    // AIコメントをGitHubに投稿
    await postCommentToPR(prInfo.owner, prInfo.repo, prInfo.pullNumber, aiComment, githubToken);
  };

  target.appendChild(button);
}

// 差分表示が読み込まれるのを監視してボタン追加
const observer = new MutationObserver(() => {
  const diffContent = document.querySelector('.js-file-content .blob-code-inner'); // このセレクタ自体は残してOK
  if (diffContent) {
    addReviewButton();
    observer.disconnect(); // ボタンが追加されたら監視を停止
  }
});


observer.observe(document.body, { childList: true, subtree: true });

//　テストコメントです。レビューしてね