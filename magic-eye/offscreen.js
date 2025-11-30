chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== "offscreen" || message.action !== "PROCESS_CROP") return;
  cropImage(message.imageUrl, message.area);
});

function cropImage(base64Data, area) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const scale = area.deviceScale || 1;

    canvas.width = area.width * scale;
    canvas.height = area.height * scale;

    ctx.drawImage(
      img,
      area.x * scale, area.y * scale, area.width * scale, area.height * scale,
      0, 0, canvas.width, canvas.height
    );

    const croppedUrl = canvas.toDataURL("image/png");
    chrome.runtime.sendMessage({
      action: "CROP_COMPLETE",
      croppedUrl: croppedUrl
    });
  };
  img.src = base64Data;
}