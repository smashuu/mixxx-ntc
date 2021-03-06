function NumarkTotalControl() {}

NumarkTotalControl.init = function(id) {	// called when the MIDI device is opened & set up
	NumarkTotalControl.id = id;	// Store the ID of this device for later use

	NumarkTotalControl.scratchTimer = {};
	NumarkTotalControl.playTimer = {};
	
	NumarkTotalControl.quantizeLEDState = false;
	NumarkTotalControl.quantizeLEDTimer = -1;
	
	NumarkTotalControl.cueing = {};
	
	NumarkTotalControl.leds = [
		// Common
		{ "directory": 0x56, "simpleCue": 0x33, "scratchMode": 0x31, "extendedLooping": 0x44, "quantize": 0x56 },
		// Deck 1
		{ "rate": 0x34, "tap": 0x30, "loopIn": 0x3a, "loopOut": 0x3b, "loopHalve": 0x38, "loopDouble": 0x39, "play":0x3e },
		// Deck 2
		{ "rate": 0x43, "tap": 0x47, "loopIn": 0x4a, "loopOut": 0x4b, "loopHalve": 0x48, "loopDouble": 0x49, "play":0x4e }
	];
	
	engine.connectControl("[Channel1]", "quantize", "NumarkTotalControl.quantizeLED");
	engine.connectControl("[Channel2]", "quantize", "NumarkTotalControl.quantizeLED");
}

NumarkTotalControl.shutdown = function(id) {	// called when the MIDI device is closed
	var lowestLED = 0x30;
	var highestLED = 0x56;
	for (var i=lowestLED; i<=highestLED; i++) {
		NumarkTotalControl.setLED(i, false);	// Turn off all the lights
	}
}

NumarkTotalControl.groupToDeck = function(group) {
	var matches = group.match(/^\[Channel(\d+)\]$/);
	if (matches == null) {
		return -1;
	} else {
		return matches[1];
	}
}
NumarkTotalControl.groupString = function(group) {
	var matches = group.match(/^\[([^\]]+)\]$/);
	if (matches == null) {
		return -1;
	} else {
		return matches[1];
	}
}

NumarkTotalControl.setLED = function(value, status) {
	if (status) {
		status = 0x64;
	} else {
		status = 0x00;
	}
	midi.sendShortMsg(0x90, value, status);
}

// Set LED to current quantize status
NumarkTotalControl.quantizeLED = function(value, group, key) {
	var deck1 = engine.getValue("[Channel1]", "quantize");
	var deck2 = engine.getValue("[Channel2]", "quantize");
	if (deck1 == deck2) {
		if (NumarkTotalControl.quantizeLEDTimer != -1) {
			engine.stopTimer(NumarkTotalControl.quantizeLEDTimer);
			NumarkTotalControl.quantizeLEDTimer = -1;
		}
		NumarkTotalControl.setLED(NumarkTotalControl.leds[0]["quantize"], deck1);
	} else if (NumarkTotalControl.quantizeLEDTimer == -1) {
		NumarkTotalControl.quantizeLEDBlink();
		NumarkTotalControl.quantizeLEDTimer = engine.beginTimer(333, "NumarkTotalControl.quantizeLEDBlink()");
	}
}

// Let LED blink on unequal quantize status
NumarkTotalControl.quantizeLEDBlink = function() {
	NumarkTotalControl.quantizeLEDStatus = !NumarkTotalControl.quantizeLEDStatus;
	NumarkTotalControl.setLED(NumarkTotalControl.leds[0]["quantize"], NumarkTotalControl.quantizeLEDStatus);
}

// Play toggle, also turns held cue button into regular play
NumarkTotalControl.play = function (channel, control, value, status, group) {
	var deck = NumarkTotalControl.groupToDeck(group);
	var groupId = NumarkTotalControl.groupString(group);
	if (value && NumarkTotalControl.playTimer[groupId] === undefined) {
		NumarkTotalControl.playTimer[groupId] = engine.beginTimer(250, "delete NumarkTotalControl.playTimer['"+groupId+"'];", true);	// Fix for my sticky play button
		if (NumarkTotalControl.cueing[groupId] !== undefined) {
			delete NumarkTotalControl.cueing[groupId];
			engine.setValue(group, "play", 1);
		} else  {
			engine.setValue(group, "play", !engine.getValue(group, "play"));
		}
	}
}

// If playing, stutters from cuepoint; otherwise plays from cuepoint until released
NumarkTotalControl.playFromCue = function (channel, control, value, status, group) {
	var groupId = NumarkTotalControl.groupString(group);
	if (value) {
		if (!engine.getValue(group, "play")) {
			NumarkTotalControl.cueing[groupId] = true;
		}
		engine.setValue(group, "cue_gotoandstop", 1);
		engine.setValue(group, "play", 1);
	} else if (NumarkTotalControl.cueing[groupId] !== undefined) {
		// Released while in cue mode
		delete NumarkTotalControl.cueing[groupId];
		engine.setValue(group, "cue_gotoandstop", 1);
	}
}

// Jog motion: (counter) fast slow still slow fast (clockwise)
// Jog values:            064  127   -   001  063
NumarkTotalControl.jogWheel = function(channel, control, value, status, group) {
	var groupId = NumarkTotalControl.groupString(group);
	var adjustedJog = parseFloat(value);
	var posNeg = 1;
	if (adjustedJog > 63) {	// Counter-clockwise
		// Jog values are 7-bit Two's complement, which JS can't deal with easily
		posNeg = -1;
		adjustedJog = value - 128;
	}
	
	var gammaInputRange = 64;	// Max jog speed
	var maxOutFraction = 0.5;	// Where on the curve it should peak; 0.5 is half-way
	var sensitivity = 0.5;		// Adjustment gamma
	var gammaOutputRange = (groupId.substr(0,7) === "Sampler") ? 15 : 3;	// Max rate change
	adjustedJog = gammaOutputRange * adjustedJog / (gammaInputRange * maxOutFraction);
	
	if (engine.getValue(group,"play")) {
		NumarkTotalControl.jogWheelStopScratch(group);
		engine.setValue(group, "jog", adjustedJog);
	} else {
		if (NumarkTotalControl.scratchTimer[groupId] === undefined) {
			engine.setValue(group, "scratch2_enable", 1);
		} else {
			engine.stopTimer(NumarkTotalControl.scratchTimer[groupId]);
		}
		engine.setValue(group, "scratch2", adjustedJog);
		NumarkTotalControl.scratchTimer[groupId] = engine.beginTimer(20, "NumarkTotalControl.jogWheelStopScratch('" + group + "')", true);
	}
}

NumarkTotalControl.jogWheelStopScratch = function(group) {
	var groupId = NumarkTotalControl.groupString(group);
	delete NumarkTotalControl.scratchTimer[groupId];
	engine.setValue(group, "scratch2_enable", 0);
}
NumarkTotalControl.selectKnob = function(channel, control, value, status, group) {
	if (value > 63) {
		value = value - 128;
	}
	engine.setValue(group, "SelectTrackKnob", value);
}

NumarkTotalControl.loopOut = function(channel, control, value, status, group) {
	if (value) {
		if (engine.getValue(group, "loop_enabled")) {
			// Loop In and Out set -> call Reloop/Exit
			engine.setValue(group, "reloop_exit", 1);
		} else {
			engine.setValue(group, "loop_out", 1);
		}
	}
}

NumarkTotalControl.cuePlayRewind = function(channel, control, value, status, group) {
	if (value) {
		engine.setValue(group, "cue_set", 1);
		engine.setValue(group, "play", 1);
	} else {
		engine.setValue(group, "play", 0);
		engine.setValue(group, "cue_gotoandstop", 1);
	}
}

NumarkTotalControl.toggleQuantize = function(channel, control, value, status, group) {
	// Toggle setting
	if (value) {
		var newValue = !(engine.getValue("[Channel1]", "quantize") && engine.getValue("[Channel2]", "quantize"));
		engine.setValue("[Channel1]", "quantize", newValue);
		engine.setValue("[Channel2]", "quantize", newValue);
	}
}
