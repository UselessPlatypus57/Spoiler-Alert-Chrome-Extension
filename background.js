// Shows the page's danger score on the toolbar icon.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'score' || !sender.tab) return;
  const d = msg.danger;
  const color = d >= 70 ? '#c0392b' : d >= 40 ? '#e67e22' : d >= 15 ? '#f1c40f' : '#27ae60';
  chrome.action.setBadgeText({ tabId: sender.tab.id, text: d > 0 ? String(d) : '' });
  chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color });
});
