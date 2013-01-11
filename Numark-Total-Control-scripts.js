function NumarkTotalControl() {}
NumarkTotalControl.init = function (id) {	// called when the MIDI device is opened & set up
	NumarkTotalControl.id = id;   // Store the ID of this device for later use
	NumarkTotalControl.scratchMode = false;
	NumarkTotalControl.simpleCue = false;
	midi.sendShortMsg(0x90, 0x33, 0x64);	// Turn on balance light
	midi.sendShortMsg(0x90, 0x34, 0x64);	// Turn on 0 rate lights
	midi.sendShortMsg(0x90, 0x43, 0x64);	// Turn on 0 rate lights
	NumarkTotalControl.testMode = false;
}
NumarkTotalControl.shutdown = function (id) {	// called when the MIDI device is closed
	var lowestLED = 0x30;
	var highestLED = 0x56;
	for (var i=lowestLED; i<=highestLED; i++) {
		midi.sendShortMsg(0x90, i, 0);	// Turn off all the lights
	}
}

// Fixes cue_set glitches
NumarkTotalControl.setCue = function(channel, control, value, status) {
	var groupChannel = channel+1;
	var group = "[Channel"+groupChannel+"]";
	if (value) {
		engine.setValue(group, "cue_set", 1);
	}
}
// For deck 2
NumarkTotalControl.setCue2 = function(channel, control, value, status) {
	NumarkTotalControl.setCue(1, control, value, status);
}

// If playing, stutters from cuepoint; otherwise jumps to cuepoint and stops
NumarkTotalControl.playFromCue = function(channel, control, value, status) {
	var groupChannel = channel+1;
	var group = "[Channel"+groupChannel+"]";
	if (value) {
		engine.setValue(group, "cue_gotoandstop", 1);
		engine.setValue(group, "cue_goto", 1);
	} else if (!NumarkTotalControl.simpleCue) {
		engine.setValue(group, "play", 0);
		engine.setValue(group, "cue_gotoandstop", 1);
	}
}
// For deck 2
NumarkTotalControl.playFromCue2 = function(channel, control, value, status) {
	NumarkTotalControl.playFromCue(1, control, value, status);
}

// Jog values: (counter) fast slow still slow fast (clockwise)
// Jog values:            064  127   -   001  063
NumarkTotalControl.jogWheel = function(channel, control, value, status) {
	var groupChannel = channel+1;
	var group = "[Channel"+groupChannel+"]";
	var adjustedJog = parseFloat(value);
	var posNeg = 1;
	if (adjustedJog > 63) {	// Counter-clockwise
		posNeg = -1;
		adjustedJog = value - 128;
	}
	
	if (NumarkTotalControl.scratchMode) {
		if (engine.getValue(group,"play")) {
			// Alter jog speeds to approximate scratching while playing
			if (adjustedJog<0) adjustedJog *= 6.25;	// Counter-clockwise
			else adjustedJog *= 2;	// Clockwise
		} else {
			adjustedJog *= .5;
		}
	} else {
		var gammaInputRange = 64;	// Max jog speed
		var maxOutFraction = .5;	// Where on the curve it should peak; 0.5 is half-way
		var sensitivity = 0.5;	// Adjustment gamma
		var gammaOutputRange = 3;	// Max rate change
		adjustedJog = posNeg*gammaOutputRange * Math.pow(Math.abs(adjustedJog)/(gammaInputRange*maxOutFraction), sensitivity);
	}
	engine.setValue(group, "jog", adjustedJog);
}
// For deck 2
NumarkTotalControl.jogWheel2 = function(channel, control, value, status) {
	NumarkTotalControl.jogWheel(1, control, value, status);
}

NumarkTotalControl.toggleScratchMode = function(channel, control, value, status) {
	// Toggle setting and light
	if (value) {
		if (NumarkTotalControl.scratchMode) {
			NumarkTotalControl.scratchMode = false;
			midi.sendShortMsg(0x90, 0x30, 0x00);
		} else {
			NumarkTotalControl.scratchMode = true;
			midi.sendShortMsg(0x90, 0x30, 0x64);
		}
	}
}

NumarkTotalControl.toggleSimpleCue = function(channel, control, value, status) {
	// Toggle setting and light
	if (value) {
		if (NumarkTotalControl.simpleCue) {
			NumarkTotalControl.simpleCue = false;
			midi.sendShortMsg(0x90, 0x32, 0x00);
		} else {
			NumarkTotalControl.simpleCue = true;
			midi.sendShortMsg(0x90, 0x32, 0x64);
		}
	}
}

NumarkTotalControl.toggleTestMode = function(channel, control, value, status) {
	// Toggle setting and light
	if (value) {
		if (NumarkTotalControl.testMode) {
			NumarkTotalControl.testMode = false;
			midi.sendShortMsg(0x90, 0x44, 0x00);
		} else {
			NumarkTotalControl.testMode = true;
			midi.sendShortMsg(0x90, 0x44, 0x64);
		}
	}
}