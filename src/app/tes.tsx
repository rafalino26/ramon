{/* Webcam Preview */}
<div className="px-4">
  <div className="overflow-hidden rounded-xl w-full" style={{ filter: applyFilter(filter) }}>
    <Webcam
      ref={webcamRef}
      audio={false}
      screenshotFormat="image/jpeg"
      videoConstraints={videoConstraints}
      className="rounded-xl w-full"
    />
  </div>
</div>
