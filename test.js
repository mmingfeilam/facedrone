var qr = require('qrcode.js')
  , fs = require('fs')
  , png = require('pngjs').PNG

fs.createReadStream('exampleqr.png')
  .pipe(new png({filterType: 4}))
  .on('parsed', function() {

    var im = this
    im.getImageData = function(){ 
      return {data: im.data}
    }

    qr.detect(im, function(err, data){

      console.log("!!",err, data.data);

      // get some points/locations
      console.log(data.info.points[0].x, data.info.points[0].y);
    })
})
