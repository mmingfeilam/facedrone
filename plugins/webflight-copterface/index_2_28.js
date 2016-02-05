var MIN_FACE_WIDTH = 150;

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
var face_cascade = new cv.CascadeClassifier(path.join(__dirname,'node_modules','opencv','data','haarcascade_profileface.xml'));
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

var UPC_SET = {
        "3211": '0',
        "2221": '1',
        "2122": '2',
        "1411": '3',
        "1132": '4',
        "1231": '5',
        "1114": '6',
        "1312": '7',
        "1213": '8',
        "3112": '9'
    };

function getBarcodeFromImage(face) {
	var canvas = require('canvas'),
	
//	var ctx = $('#copterface').get(0).getContext('2d');
//	var canvas = ctx.canvas;
//	var img = new canvas.Image;
//	img.src = saveImagePath;
//    var doc = document,
//        img = "object" == typeof imgOrId ? imgOrId : doc.getElementById(imgOrId),
//        canvas = doc.createElement("canvas"),
//        var width = face.width,
//        height = face.height,
        ctx = canvas.getContext("2d"),
        spoints = [1, 9, 2, 8, 3, 7, 4, 6, 5],
        numLines = spoints.length,
        slineStep = height / (numLines + 1),
        round = Math.round;
//    canvas.width = width;
//    canvas.height = height;
//    ctx.drawImage(img, 0, 0);
    
    var image = fs.readFileSync(saveImagePath);
    var width = image.width,
    height = image.height;
    
    while(numLines--){
        console.log(spoints[numLines]);
        var pxLine = ctx.getImageData(0, slineStep * spoints[numLines], width, 2).data,
            sum = [],
            min = 0,
            max = 0;
        for(var row = 0; row < 2; row++){
            for(var col = 0; col < width; col++){
                var i = ((row * width) + col) * 4,
                    g = ((pxLine[i] * 3) + (pxLine[i + 1] * 4) + (pxLine[i + 2] * 2)) / 9,
                    s = sum[col];
                pxLine[i] = pxLine[i + 1] = pxLine[i + 2] = g;
                sum[col] = g + (undefined == s ? 0 : s);
            }
        }
        for(var i = 0; i < width; i++){
            var s = sum[i] = sum[i] / 2;
            if(s < min){ min = s; }
            if(s > max){ max = s; }
        }
        var pivot = min + ((max - min) / 2),
            bmp = [];
        for(var col = 0; col < width; col++){
            var matches = 0;
            for(var row = 0; row < 2; row++){
                if(pxLine[((row * width) + col) * 4] > pivot){ matches++; }
            }
            bmp.push(matches > 1);
        }
        var curr = bmp[0],
            count = 1,
            lines = [];
        for(var col = 0; col < width; col++){
            if(bmp[col] == curr){ count++; }
            else{
                lines.push(count);
                count = 1;
                curr = bmp[col];
            }
        }
        var code = '',
            bar = ~~((lines[1] + lines[2] + lines[3]) / 3),
            u = UPC_SET;
        for(var i = 1, l = lines.length; i < l; i++){
            if(code.length < 6){ var group = lines.slice(i * 4, (i * 4) + 4); }
            else{ var group = lines.slice((i * 4 ) + 5, (i * 4) + 9); }
            var digits = [
                round(group[0] / bar),
                round(group[1] / bar),
                round(group[2] / bar),
                round(group[3] / bar)
            ];
            code += u[digits.join('')] || u[digits.reverse().join('')] || 'X';
            if(12 == code.length){ return code; break; }
        }
        if(-1 == code.indexOf('X')){ return code || false; }
    }
    return false;
}

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
//      	console.log("/copterface", "read image");
        // 2. Read picture (takes between 60 and 100 ms)
        cv.readImage( lastPng, function(err, im) {
          cb(err,im);
        });
      },
	function(im, cb) {
	// console.log("/copterface", "face detect");
	// 3. Detect faces (takes between 200 and 250 ms)
		var opts = {};
		face_cascade.detectMultiScale(im, function(err, faces) {
			cb(err, faces, im);
		}, opts.scale, opts.neighbors, opts.min && opts.min[0],
				opts.min && opts.min[1]);
	},
      function(faces, im, cb) {
	      var face;
	      var biggestFace;
	      var dt = DT; // minimum time for the next detection
	
	      for(var k = 0; k < faces.length; k++) {
	        face = faces[k];
	        if( !biggestFace || biggestFace.width < face.width ) biggestFace = face;
	      }
		
    	  	im.save(saveImagePath);
    	  	var code = getBarcodeFromImage(face);
    	  	console.log('code: ' + code);
    	  	
      }
      
//      function(im, cb) {
////      	console.log("/copterface", "face detect");
//        // 3. Detect faces (takes between 200 and 250 ms)
//        var opts = {};
//        face_cascade.detectMultiScale(im, function(err, faces) {
//          cb(err, faces, im);
//        }, opts.scale, opts.neighbors
//         , opts.min && opts.min[0], opts.min && opts.min[1]);
//      },
//      function(faces, im, cb) {
//      	//var im2 = im;
//      	
////      	console.log("copterface", "analyze face");
//        // 4. Analyze faces
//        var face;
//        var biggestFace;
//        var dt = DT; // minimum time for the next detection
//
//        for(var k = 0; k < faces.length; k++) {
//          face = faces[k];
//          if( !biggestFace || biggestFace.width < face.width ) biggestFace = face;
//        }
//
//        if( biggestFace ) {
////        		console.log("copterface", "biggest face");
//	        	var userName = '';
//	        	var confidenceLevel = '';
//	        	var imag = null;
//	        	
////	        	console.log("copterface", "save img");
//	      	im.save(saveImagePath);
//	      		
////	      	console.log("copterface", "read back saved img");
////	    		console.log("copterface", "crop and save cropped img");
//      		gm(saveImagePath)
//	      		.crop(face.width, face.height, face.x, face.y)
//	      		.resize('100', '100', '^')
//	      		.write(saveCroppedImagePath, function(err)
//	      		{
////	      			console.log("copterface", "inside crop and save cropped img");
//	      			if (err) {
//	      				console.log('error occurred: ' + err);
//	      			}
//	      		});
//	        	
////	        console.log("copterface", "face recognition");
//	        var trainingData = [];
//
//	    		// Collect all the images we are going to use to train the algorithm
////	    		for (var i = 1; i<7; i++){
////	      			trainingData.push([1,"/Users/212353126/Documents/Hack/Samples/yash" + i + ".jpg" ]);
////	    		}
//	    		
////	    		for (var j = 1; j<10; j++){
////	      			trainingData.push([1,"/Users/212353126/Documents/Hack/Samples/lam" + j + ".jpg" ]);
////	    		}
//	        
//	        for (var j = 1; j<30; j++){
//      			trainingData.push([1,"/Users/212353126/Documents/Hack/Samples/mikeLayer" + j + ".jpg" ]);
//    			}
//	    		
////	    		for (var j = 1; j<10; j++){
////	      			trainingData.push([1,"/Users/212353126/Documents/Hack/Samples/lam" + j + " copy.jpg" ]);
////	    		}
//	    		
////	    		for (var j = 20; j<26; j++){
////	      			trainingData.push([1,"/Users/212353126/Documents/Hack/Samples/lam" + j + ".jpg" ]);
////	    		}
//	    		
////	    		for (var j = 1; j<12; j++){
////	      			trainingData.push([2,"/Users/212353126/Documents/Hack/Samples/sean_" + j + "a.jpg" ]);
////	    		}
////	    		
////	    		for (var j = 1; j<12; j++){
////	      			trainingData.push([2,"/Users/212353126/Documents/Hack/Samples/sean_" + j + ".jpg" ]);
////	    		}
////	    		
////	    		for (var j = 1; j<13; j++){
////	      			trainingData.push([2,"/Users/212353126/Documents/Hack/Samples/sean_" + j + "b.jpg" ]);
////	    		}
//	    		
//	    		for (var j = 1; j<30; j++){
//	      			trainingData.push([2,"/Users/212353126/Documents/Hack/Samples/SeanLayer" + j + ".jpg" ]);
//	    		}
//	    		
////	    		for (var i = 1; i<7; i++){
////      			trainingData.push([3,"/Users/212353126/Documents/Hack/Samples/angelina" + i + ".jpg" ]);
////	    		}
//	    		
//	    		// Test algorithm
//	    		cv.readImage(saveCroppedImagePath, function(e, im1) {
//	    //cv.readImage("/Users/212353126/Documents/Hack/2015-02-15_2058.png", function(e, im1){
//
//	    			var facerec1 = cv.FaceRecognizer.createFisherFaceRecognizer();
//	    			facerec1.trainSync(trainingData);
//
//	    			// Try to recognize the person 
//	    			userName = '';
//	    			var userId = '';
//	    			var prediction = facerec1.predictSync(im1);
//	    			userId = prediction.id;
//	    			
//	    			confidenceLevel = parseFloat(prediction.confidence);
//	    			
//	    			if(confidenceLevel > 1500.0) {
//		    			switch(userId) {
//		    			case 1:
//		    				userName = "Mike";
//		    				break;
//		    			case 2:
//		    				userName = "Sean";
//		    				break;
//		    			case 3:
//		    				userName = "Angelina";
//		    				break;
//		    			default:
//		    				userName = '';
//		    				break;
//		    			}
//	    			}
////	    			console.log("test face recognition with live image: " + userName);
////	    			console.log("face.width: " + face.width);
////	    			console.log("face.height: " + face.height);
////	    			console.log("im.width(): " + im.width());
////	    			console.log("im.height(): " + im.height());
//	    		});
//	    		
//          face = biggestFace;
//          
//          if(userName !== '' && face.width > MIN_FACE_WIDTH) {
//        	  	io.sockets.emit('face', { x: face.x, y: face.y, w: face.width, h: face.height, iw: im.width(), ih: im.height(), user: userName, confidence: confidenceLevel });
//          } else {
//        	  	io.sockets.emit('clear_face');
//          }
//          
//          face.centerX = face.x + face.width * 0.5;
//          face.centerY = face.y + face.height * 0.5;
//
//          var centerX = im.width() * 0.5;
//          var centerY = im.height() * 0.5;
////          
////          console.log('face centerX: ' + face.centerX);
////          console.log('canvas centerX: ' + centerX);
////          
////          if(centerX > face.centerX) {
////        	  	console.log('move left');
////          } else if(centerX < face.centerX) {
////        	  	console.log('move right');
////          }
////          
////          console.log('face centerY: ' + face.centerY);
////          console.log('canvas centerY: ' + centerY);
////          if(centerY > face.centerY) {
////      	  	console.log('move up');
////	      } else if(centerY < face.centerY) {
////	      	console.log('move down');
////	      }
//          
//          var heightAmount = -( face.centerY - centerY ) / centerY;
//          var turnAmount = -( face.centerX - centerX ) / centerX;
//
//          heightAmount = ver_ctrl.update(-heightAmount); // pid
//          turnAmount   = hor_ctrl.update(-turnAmount);   // pid
//
//          var lim = 0.1;
//          if( Math.abs( turnAmount ) > lim || Math.abs( heightAmount ) > lim ){
////            log( "  turning " + turnAmount );
//            if (debug) io.sockets.emit('/message', 'turnAmount : ' + turnAmount);
//            if( turnAmount < 0 ) client.clockwise( Math.abs( turnAmount ) );
//            else client.counterClockwise( turnAmount );
//
////            log( "  going vertical " + heightAmount );
//            if (debug) io.sockets.emit('/message', 'heightAmount : ' + heightAmount);
//            if(  heightAmount < 0 ) client.down( Math.abs(heightAmount) );
//            else client.up( heightAmount );
//          }
//          else {
//            if (debug) io.sockets.emit('/message', 'pause!');
//            client.stop();
//          }
//
//          // to determine how much time the drone will move, we use the lower of the changes [-1,1], and multiply by a reference time.
//          dt = Math.min(Math.abs(turnAmount), Math.abs(heightAmount));
//          dt = dt * 2000;
//        }
//        
//        processingImage = false;
//        cb(null, dt);
//      }
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
//            console.log("copterface", cmd);
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
