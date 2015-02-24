var cv = require('opencv');
var gm = require('gm');
var imagick = require('imagemagick');
//var mailer = require("nodemailer");

var fs    = require('fs')
  , path  = require('path')
  , async = require('async')
  , Controller   = require('node-pid-controller')
  , events       = require('events')
  , EventEmitter = new events.EventEmitter()
  ;

var DT = 150; // time between faces detection

var client, io, lastPng;
var tracking = false;
var debug = true;
var processingImage = false;
var face_cascade = new cv.CascadeClassifier(path.join(__dirname,'node_modules','opencv','data','haarcascade_frontalface_alt2.xml'));
var saveImagePath = '/Users/212353126/Documents/Hack/test.jpg';
var saveCroppedImagePath = '/Users/212353126/Documents/Hack/cropped.jpg';

/** 
 *  Controllers initialization.
 */
var ver_ctrl = new Controller(0.3, 0.01, 0.1)
  , hor_ctrl = new Controller(0.4, 0.01, 0.1)
  ;

function log(string) {
    if (debug) {
        console.log(string);
    }
}

var times = [];

function detectFaces() {
  if(tracking && (!processingImage) && lastPng) {
    processingImage = true;

    async.waterfall([
      function(cb) {
//      	console.log("/copterface", "stop drone before taking pic");
        // 1. Stop the Drone before taking picture
        client.stop();
        setTimeout(function() { // wait the drone stabilization for a new image
          EventEmitter.once('newPng', function() {
            cb();
          });
        }, 200);
      },
      function(cb) {
      	console.log("/copterface", "read image");
        // 2. Read picture (takes between 60 and 100 ms)
        cv.readImage( lastPng, function(err, im) {
          cb(err,im);
        });
      },
      function(im, cb) {
      	console.log("/copterface", "face detect");
        // 3. Detect faces (takes between 200 and 250 ms)
        var opts = {};
        face_cascade.detectMultiScale(im, function(err, faces) {
          cb(err, faces, im);
        }, opts.scale, opts.neighbors
         , opts.min && opts.min[0], opts.min && opts.min[1]);
      },
      function(faces, im, cb) {
      	//var im2 = im;
      	
//      	console.log("copterface", "analyze face");
        // 4. Analyze faces
        var face;
        var biggestFace;
        var dt = DT; // minimum time for the next detection

        for(var k = 0; k < faces.length; k++) {
          face = faces[k];
          if( !biggestFace || biggestFace.width < face.width ) biggestFace = face;
        }

        if( biggestFace ) {
        		console.log("copterface", "biggest face");
	        	var userName = '';
	        	var imag = null;
	        	
	        	console.log("copterface", "save img");
	      	im.save(saveImagePath);
	      		
	      	console.log("copterface", "read back saved img");
	    		console.log("copterface", "crop and save cropped img");
      		gm(saveImagePath)
	      		.crop(face.width, face.height, face.x, face.y)
	      		.resize('100', '100', '^')
	      		.write(saveCroppedImagePath, function(err)
	      		{
	      			console.log("copterface", "inside crop and save cropped img");
	      			if (err) {
	      				console.log('error occurred: ' + err);
	      			}
	      		});
	        	
//	        console.log("copterface", "face recognition");
	        var trainingData = [];

	    		// Collect all the images we are going to use to train the algorithm
	    		for (var i = 1; i<7; i++){
	      			trainingData.push([1,"/Users/212353126/Documents/Hack/Samples/yash" + i + ".jpg" ]);
	    		}
	    		
	    		for (var j = 1; j<10; j++){
	      			trainingData.push([2,"/Users/212353126/Documents/Hack/Samples/lam" + j + ".jpg" ]);
	    		}
	    		
	    		for (var j = 1; j<10; j++){
	      			trainingData.push([3,"/Users/212353126/Documents/Hack/Samples/angelina" + j + ".jpg" ]);
	    		}
	    		
	    		// Test algorithm
	    		cv.readImage(saveCroppedImagePath, function(e, im1) {
	    //cv.readImage("/Users/212353126/Documents/Hack/2015-02-15_2058.png", function(e, im1){

	    			var facerec1 = cv.FaceRecognizer.createFisherFaceRecognizer();
	    			facerec1.trainSync(trainingData);

	    			// Try to recognize the person 
	    			userName = '';
	    			var userId = '';
	    			userId = facerec1.predictSync(im1).id;
	    			
	    			switch(userId) {
	    			case 1:
	    				userName = "Yash";
	    				break;
	    			case 2:
	    				userName = "Mike";
	    				break;
	    			case 3:
	    				userName = "Angelina";
	    				break;
	    			default:
	    				break;
	    			}
	    			console.log("test face recognition with live image: " + userName);
	    		});
	    		
          face = biggestFace;
          
          if(userName !== '') {
          io.sockets.emit('face', { x: face.x, y: face.y, w: face.width, h: face.height, iw: im.width(), ih: im.height(), user: userName });
          }
          
          face.centerX = face.x + face.width * 0.5;
          face.centerY = face.y + face.height * 0.5;

          var centerX = im.width() * 0.5;
          var centerY = im.height() * 0.5;

          var heightAmount = -( face.centerY - centerY ) / centerY;
          var turnAmount = -( face.centerX - centerX ) / centerX;

          heightAmount = ver_ctrl.update(-heightAmount); // pid
          turnAmount   = hor_ctrl.update(-turnAmount);   // pid

          var lim = 0.1;
          if( Math.abs( turnAmount ) > lim || Math.abs( heightAmount ) > lim ){
            log( "  turning " + turnAmount );
            if (debug) io.sockets.emit('/message', 'turnAmount : ' + turnAmount);
            if( turnAmount < 0 ) client.clockwise( Math.abs( turnAmount ) );
            else client.counterClockwise( turnAmount );

            log( "  going vertical " + heightAmount );
            if (debug) io.sockets.emit('/message', 'heightAmount : ' + heightAmount);
            if(  heightAmount < 0 ) client.down( Math.abs(heightAmount) );
            else client.up( heightAmount );
          }
          else {
            if (debug) io.sockets.emit('/message', 'pause!');
            client.stop();
          }

          // to determine how much time the drone will move, we use the lower of the changes [-1,1], and multiply by a reference time.
          dt = Math.min(Math.abs(turnAmount), Math.abs(heightAmount));
          dt = dt * 2000;
        }
        
        processingImage = false;
        cb(null, dt);
      }
    ], function(err, dt) {
      dt = Math.max(dt, DT);
      setTimeout(detectFaces, dt);
    });
  } else {
    if (tracking) setTimeout(detectFaces, DT);
  };
};

var saveImage=function(im){
    im.write(saveImagePath, function (err) {
        if (err){
            console.log(err);
            next(connection,true);
        } else {
            var img = fs.readFileSync(saveImagePath);
            res.writeHead(200, {'Content-Type': 'image/'+type});
            res.end(img, 'binary');
        }
    });
};

function copterface(name, deps) {
    debug = deps.debug || false;
    io = deps.io;
    io.sockets.on('connection', function (socket) {
        socket.on('/copterface', function (cmd) {
            console.log("copterface", cmd);
            if (cmd == "toggle") {
              client.stop(); // make sure to stop the helicopter if stop copterface
              tracking = tracking ? false : true;
              if (tracking) detectFaces();
            } 
        });
    });

    client = deps.client;
    client.createPngStream()
      .on('error', console.log)
      .on('data', function(pngBuffer) {
      lastPng = pngBuffer;
      EventEmitter.emit('newPng');
    });

}

module.exports = copterface;
