// TODO Week 3 (optional): Webcam QR scan
// Dùng @zxing/browser BrowserMultiFormatReader
// Sau khi scan thành công → redirect /trace/{publicCode}

'use client';

export function QrScanner() {
  // TODO Week 3:
  // const codeReader = new BrowserMultiFormatReader()
  // codeReader.decodeFromVideoDevice(null, videoRef.current, (result) => {
  //   if (result) router.push(`/trace/${result.getText()}`)
  // })
  return (
    <div className="qr-scanner rounded border-2 border-dashed border-gray-300 p-8 text-center">
      <p className="text-sm text-gray-400">QrScanner — Tuần 3</p>
    </div>
  );
}
