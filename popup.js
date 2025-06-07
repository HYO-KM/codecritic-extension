// HTMLドキュメントが完全に読み込まれて準備ができたときに実行される関数
document.addEventListener('DOMContentLoaded', () => {
  // HTML要素をJavaScriptから操作するために、IDを使って要素を取得します。
  const geminiApiKeyInput = document.getElementById('geminiApiKey');
  const githubTokenInput = document.getElementById('githubToken');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');

  // ★ 1. 拡張機能が開かれたときに、保存されている設定値を読み込んでフォームに表示する ★
  // chrome.storage.local.get() を使って、ローカルストレージからデータを取得します。
  // 引数には、取得したいキー名の配列を渡します（['geminiApiKey', 'githubToken']）。
  // データが取得されると、第2引数のコールバック関数が実行され、その引数 'result' にデータが含まれます。
  chrome.storage.local.get(['geminiApiKey', 'githubToken'], (result) => {
    // もし result.geminiApiKey に値があれば、それを入力フォームのvalueに設定します。
    if (result.geminiApiKey) {
      geminiApiKeyInput.value = result.geminiApiKey;
    }
    // もし result.githubToken に値があれば、それを入力フォームのvalueに設定します。
    if (result.githubToken) {
      githubTokenInput.value = result.githubToken;
    }
  });

  // ★ 2. 「保存」ボタンがクリックされたときの処理を設定する ★
  // saveButton 要素にクリックイベントリスナーを追加します。
  saveButton.addEventListener('click', () => {
    // 入力フォームから現在の値を取得します。
    const geminiApiKey = geminiApiKeyInput.value;
    const githubToken = githubTokenInput.value;

    // chrome.storage.local.set() を使って、データをローカルストレージに保存します。
    // 引数には、保存したいキーと値のペアをオブジェクト形式で渡します（{ キー名: 値 }）。
    // 保存が完了すると、第2引数のコールバック関数が実行されます。
    chrome.storage.local.set({ geminiApiKey: geminiApiKey, githubToken: githubToken }, () => {
      // 保存が成功したことをユーザーに知らせるメッセージを表示します。
      statusDiv.textContent = '設定を保存しました！';
      // 2秒後にメッセージを消します。
      setTimeout(() => {
        statusDiv.textContent = '';
      }, 2000);
    });
  });
});