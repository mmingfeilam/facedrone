(function (window, undefined) {
  'use strict';

  var CF;

  CF = function CopterFace(cockpit) {
    console.log("Loading Copterface plugin.");

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

    // Bind on window events to resize
    $(window).resize(function(event) {
      self.draw();
    });

    $(document).keypress(function(ev) {
      self.keyPress(ev);
    });
  };

  CF.prototype.keyPress = function(ev) {
    console.log("Keypress: " + ev.keyCode);
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
    this.ctx.strokeStyle = 'black';
    this.ctx.lineWidth = 2;
    
    var userName = data.user;
    this.cockpit.socket.emit("/copterface", "strokeRect");
    this.ctx.strokeRect(x,y,w,h);
    this.cockpit.socket.emit("/copterface", "strokeRect2");
    this.cockpit.socket.emit("/copterface", userName);
    this.ctx.strokeStyle = 'red';
    this.ctx.font="50px Georgia";
    this.cockpit.socket.emit("/copterface", "x: " + x);
    this.cockpit.socket.emit("/copterface", "y: " + y);
    this.ctx.strokeText(userName,x,y);
    
    this.ctx.restore();
    this.cockpit.socket.emit("/copterface", "strokeRect3");
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
