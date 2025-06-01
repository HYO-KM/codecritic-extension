function getPRInfoFromURL() {
  const match = window.location.pathname.match(/\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
    pullNumber: match[3]
  };
}


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


async function generateReviewComment(diffText) {
  const apiKey = prompt("OpenAI APIキーを入力してください（開発用）");
  if (!apiKey) return;

  const promptText = `
あなたはプロのソフトウェアエンジニアです。以下はGitHubのPull Requestの差分です。
この変更に対してレビューコメントをいくつか日本語で出してください。
具体的に改善点・バグ・設計の問題があれば挙げてください。

--- 差分ここから ---
${diffText}
--- 差分ここまで ---
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo', // ← 必要に応じてgpt-3.5-turboに変更
      messages: [{ role: 'user', content: promptText }],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    console.error("OpenAI APIエラー:", await response.text());
    alert("レビュー生成に失敗しました");
    return;
  }

  const data = await response.json();
  const comment = data.choices?.[0]?.message?.content;
  console.log("AIレビューコメント:", comment);
  return comment; // ← これを忘れずに！
}



// async function getDiffText() {
//   const diffElements = document.querySelectorAll('.js-file-content .blob-code-inner');
//   if (!diffElements.length) {
//     alert("差分コードが見つかりません");
//     return;
//   }

//   const diffText = Array.from(diffElements)
//   .map(el => el.innerText)
//   .join('\n');
//   console.log("差分:", diffText);

//   await generateReviewComment(diffText);
// }

function addReviewButton() {
  // 既にボタンがある場合は処理しない
  if (document.getElementById('codecritic-review-button')) return;

  const target = document.querySelector('.gh-header-actions');
  if (!target) return;

  // ✅ ここで button を定義
  const button = document.createElement('button');
  button.id = 'codecritic-review-button';
  button.innerText = 'AIレビュー生成';
  button.className = 'btn btn-sm';
  button.style.marginLeft = '10px';

  button.onclick = async () => {
  const diffElements = document.querySelectorAll('.js-file-content .blob-code-inner');
  const diffText = Array.from(diffElements).map(el => el.innerText).join('\n');

  const aiComment = await generateReviewComment(diffText);
  // generateReviewComment 関数の最後に return を追加
  return aiComment;

  if (!aiComment) return;

  const prInfo = getPRInfoFromURL();
  if (!prInfo) {
    alert("PR情報がURLから取得できませんでした。");
    return;
  }

  const githubToken = prompt("GitHubのPersonal Access Tokenを入力してください（開発用）");
  if (!githubToken) return;

  await postCommentToPR(prInfo.owner, prInfo.repo, prInfo.pullNumber, aiComment, githubToken);
};


  target.appendChild(button);
}

// 差分表示が読み込まれるのを監視してボタン追加
const observer = new MutationObserver(() => {
  const diffContent = document.querySelector('.js-file-content .blob-code-inner');
  if (diffContent) {
    addReviewButton();
    observer.disconnect();
  }
});

observer.observe(document.body, { childList: true, subtree: true });
