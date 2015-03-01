var ACCELERATION = 0.5;
var DIFFERENCE_LIMIT = 5;
(function (window, undefined) {
  'use strict';

  var CF;

  CF = function CopterFace(cockpit) {
//    console.log("Loading Copterface plugin.");

    // Instance variables
    this.cockpit = cockpit;
    this.tracking = false;

    // Add required UI elements
    $("#cockpit").append('<canvas id="copterface" width="640" height="360"></canvas>');
    $("#cockpit").append('<div id="copterface-label" style="display:none;">Face Tracking ON</div>');
    this.ctx = $('#copterface').get(0).getContext('2d');

    // Bind to navdata events on websockets
    var self = this;
    this.cockpit.socket.on('face', function(data) {
      if (self.tracking && !jQuery.isEmptyObject(data)) {
        requestAnimationFrame(function() {
          self.render(data);
        });
      }
    });
    
    this.cockpit.socket.on('clear_face', function() {
    		self.clear();
	  });

    // Bind on window events to resize
    $(window).resize(function(event) {
      self.draw();
    });

    $(document).keypress(function(ev) {
      self.keyPress(ev);
    });
  };

  CF.prototype.keyPress = function(ev) {
//    console.log("Keypress: " + ev.keyCode);
    if (ev.keyCode != 109) {
      return;
    }

    ev.preventDefault();
    this.tracking = this.tracking ? false : true;
    this.cockpit.socket.emit("/copterface", "toggle");
    this.clear();
    if (this.tracking) {
        $("#copterface-label").show();
    } else {
        $("#copterface-label").hide();
    }
  }

  var previousFaceWidth = -1;
  
  CF.prototype.render = function(data) {
	
  	this.cockpit.socket.emit("/copterface", "render");
    this.ctx.canvas.width = $('#cockpit').innerWidth();
    this.ctx.canvas.height = $('#cockpit').innerHeight();
      
    var cw = this.ctx.canvas.width;
    var ch = this.ctx.canvas.height;

    var x = (data.x/data.iw) * cw;
    var y = (data.y/data.ih) * ch;
    var w = (data.w/data.iw) * cw;
    var h = (data.h/data.ih) * ch;
    
    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.save();
    this.ctx.strokeStyle = 'red';
    this.ctx.lineWidth = 4;
    
    var userName = data.user;
    var confidence = data.confidence;
//    this.cockpit.socket.emit("/copterface", "strokeRect");
    this.ctx.strokeRect(x,y,w,h);
//    this.cockpit.socket.emit("/copterface", "strokeRect2");
//    this.cockpit.socket.emit("/copterface", userName);
    this.ctx.strokeStyle = 'red';
    this.ctx.font="50px Georgia";
//    this.cockpit.socket.emit("/copterface", "x: " + x);
//    this.cockpit.socket.emit("/copterface", "y: " + y);
    this.ctx.strokeText(userName + ' ' + confidence,x,y);
    
    this.ctx.restore();
//    this.cockpit.socket.emit("/copterface", "strokeRect3");
    
    var faceCenterX = data.x + data.w * 0.5;
    var faceCenterY = data.y + data.h * 0.5;

    var centerX = data.iw * 0.5;
    var centerY = data.ih * 0.5;
    
//    this.cockpit.socket.emit("/copterface", 'face centerX: ' + faceCenterX);
//    this.cockpit.socket.emit("/copterface", 'face centerY: ' + faceCenterY);
//    this.cockpit.socket.emit("/copterface", 'canvas centerX: ' + centerX);
//    this.cockpit.socket.emit("/copterface", 'canvas centerY: ' + centerY);
    this.cockpit.socket.emit("/copterface", 'previous face width: ' + previousFaceWidth);
    this.cockpit.socket.emit("/copterface", 'face width: ' + data.w);
//    this.cockpit.socket.emit("/copterface", 'face height: ' + h);
//    this.cockpit.socket.emit("/copterface", 'canvas width: ' + cw);
//    this.cockpit.socket.emit("/copterface", 'canvas height: ' + ch);
    
    var cmd = {};
    cmd.ev = 'move';
    var followSpeed = 0;
    var diffX, diffY, diffZ;
    
    diffX = Math.abs(centerX - faceCenterX);
    diffY = Math.abs(centerY - faceCenterY);
    diffZ = data.w - previousFaceWidth;
    
//    this.cockpit.socket.emit("/copterface", 'diffX: ' + diffX);
//    this.cockpit.socket.emit("/copterface", 'diffY: ' + diffY);
    this.cockpit.socket.emit("/copterface", 'diffZ: ' + diffZ);
    
    // Only move if the difference > DIFFERENCE_LIMIT
    if(diffX > DIFFERENCE_LIMIT) {
	    if(centerX > faceCenterX) {
//	    		this.cockpit.socket.emit("/copterface",'move left');
//    			cmd.action = 'left';
	    } else if(centerX < faceCenterX) {
//	    		this.cockpit.socket.emit("/copterface",'move right');
//			cmd.action = 'right';
	    } 
	    
	    followSpeed = ACCELERATION*2;
	    this.cockpit.socket.emit("/pilot/" + cmd.ev, {
	        action : cmd.action,
	        speed: followSpeed
	    });
    }
    
    if(diffY > DIFFERENCE_LIMIT) {
	    if(centerY > faceCenterY) {
//	    	this.cockpit.socket.emit("/copterface",'move up');
		  	cmd.action = 'up';
	    } else if(centerY < faceCenterY) {
//	    	this.cockpit.socket.emit("/copterface",'move down');
	    		cmd.action = 'down';
	    }
	    
	    followSpeed = ACCELERATION;
	    
	    this.cockpit.socket.emit("/pilot/" + cmd.ev, {
	        action : cmd.action,
	        speed: followSpeed
	    });
    }
    
    var absDiffZ = Math.abs(diffZ);
    if(absDiffZ > 2) {
    		// Person moving in closer to camera
    		if(diffZ > 0) {
//		    	this.cockpit.socket.emit("/copterface",'move back');
			  	cmd.action = 'back';
	    } else {
//		    	this.cockpit.socket.emit("/copterface",'move front');
		    		cmd.action = 'front';
	    }
	    
	    followSpeed = ACCELERATION*3;
	    
	    this.cockpit.socket.emit("/pilot/" + cmd.ev, {
	        action : cmd.action,
	        speed: followSpeed
	    });
    }
   
    
    // Now set the previousFaceWidth to current value for next comparison
    previousFaceWidth = data.w;
  }

  CF.prototype.clear = function() {
    this.ctx.canvas.width = $('#cockpit').innerWidth();
    this.ctx.canvas.height = $('#cockpit').innerHeight();
      
    var cw = this.ctx.canvas.width;
    var ch = this.ctx.canvas.height;
    
    this.ctx.clearRect(0, 0, cw, ch);
  }

  window.Cockpit.plugins.push(CF);

}(window, undefined));
