(function(window, document) {
        'use strict';

        /*
         * Constructuor
         */
        var Blackbox = function Blackbox(cockpit) {
                console.log("Loading Blackbox plugin.");
                this.cockpit = cockpit;
                this.recording = false;

                // Register the various event handlers
                this.listen();
        };

        /*
         * Register keyboard event listener
         */
        Blackbox.prototype.listen = function listen() {
                var self = this;
                $(document).keydown(function(ev) {
                        self.keyDown(ev);
                });
        };

        /*
         * Process onkeydown. 
         */
        Blackbox.prototype.keyDown = function keyDown(ev) {
                if ([ev.keyCode] != 82) {
                        return;
                } 
                ev.preventDefault();

            console.log('autonomous');

            mission.takeoff()
//    .zero()       // Sets the current state as the reference
                .hover(1000)
                .altitude(1)  // Climb to altitude = 1 meter
                .left(.5)
                .hover(1000)
//    .ccw(15)
                .left(.5)
                .hover(1000)
//    .left(.25)
//    .hover(1000)
//    .left(.25)
//    .hover(1000)
//    .left(.25)
//    .hover(1000)
//    .ccw(15)
//    .hover(1000)
//    .right(.25)
//    .hover(1000)
//    .right(.25)
//    .hover(1000)
//    .right(.25)
//    .hover(1000)
//    .right(1)
//    .hover(1000)
//    .right(1)
//    .hover(1000)
//    .left(.25)
//    .hover(1000)  // Hover in place for 1 second
//    .left(.25)
//    .hover(1000)
//    .left(.25)
//    .hover(1000)
//    .left(.25)
//    .left(.25)
//    .left(.25)
                .land();

            mission.run(function (err, result) {
                if (err) {
                    console.trace("Oops, something bad happened: %s", err.message);
                    mission.client().stop();
                    mission.client().land();
                } else {
                    console.log("Mission success!");
                    process.exit(0);
                }
            });



//                this.recording = !this.recording;
//                var cmd = this.recording ? "stop" : "start";
//                this.cockpit.socket.emit("/blackbox/" + cmd, {});
        };

        window.Cockpit.plugins.push(Blackbox);

}(window, document));
