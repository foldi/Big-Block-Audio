/**
 * Big Block Audio
 * Copyright (C) 2011 Foldi, LLC
 *
 * Provides an interface to play audio files in an HTML 5 compliant web browser.
 * 
 * @author Vince Allen 01-01-2011
 * 
 * 
 */

BigBlockAudio = (function () {
	
	var Log, supported;
	
	Log = function (str) {
		var msg;
		try {
			if (BigBlockAudio.debug_message_target) {
				msg = document.createTextNode(str + "\n");
				BigBlockAudio.debug_message_target.appendChild(msg);				
			} else {
				if (typeof(console) !== "undefined") {
					console.log(str); // output error to console
				} else if (typeof(opera) !== "undefined" && typeof(opera.wiiremote) !== "undefined") { // wii uses alerts
					alert(str);
				} else if (typeof(opera) !== "undefined") { // opera uses error console
					opera.postError(str);
				}
			}
		} catch(e) {
		  // do nothing
		}			
	}
	
	supported = true;

	if (typeof(window.Audio) === "undefined") {
		supported = false;
		Log("This browser does not support HTML5 audio.");
	}															

	return {

		alias : "audio",
		supported : supported,
		playlist : {}, // contains instances of Audio elements
		pause_timeout: null,
		debug_message_target: null, // the id of a dom element that will receive debug messages; typically a textarea
		debug: false,
		is_single_channel: false, 
		single_channel_id: null, // the id of the single channel Audio element
		last_play: new Date().getTime(), // the last time the single channel Audio element played 
		last_play_delay: 50, // the time to wait before allowing the single channel Audio element to play
		muted : false,	
		format: ["wav", "mp3", "ogg"],
		loading_list: [],
		loading_complete: false,
		after_loading_complete: false,
		/**
		 * Adds an audio element to the DOM. Also runs load() to set up the audio file for playback.
		 * Uses new Audio([url]) which returns a new audio element, with the src attribute set to the value passed in the argument, if applicable.
		 * 
		 * @param {String} id
		 * @param {String} path
		 * @param {String} loop
		 * @param {Function} after_load
		 * 
		 */				
		add: function(id, path, loop, after_load) {

			var f, i, mime_type, supported_mime_type, audio;

			if (supported) {

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}				
					if (typeof(path) === "undefined") {
						throw new Error("Path to audio file required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ': ' + e.message);
				}

				for (f = 0; f < this.format.length; f++) { // loop thru formats to find the first that this browser will play

					mime_type = BigBlockAudio.getMimeTypeFromFileExt(this.format[f]); // get mime-type

					audio = new Audio(path + id + "." + this.format[f]); // create audio element

					if (loop) {
						audio.loop = loop;
					}

					supported_mime_type = ""; // loop thru mime_type

					for (i = 0; i < mime_type.length; i++) {
						supported_mime_type = this.canPlayType(audio, mime_type[i]); // check media.canPlayType 
						if (supported_mime_type !== "") {
							if (this.debug) {
								BigBlockAudio.Log("This browser will try to play " + id + " audio file in " + mime_type[i] + " format.");
							}
							break;
						}
					}

					if (supported_mime_type !== "") {
						break;
					}

				}

				if (supported_mime_type !== "") {

					audio.id = id; // add the id to the audio element; useful to identify audio file when events fire
					this.playlist[id] = audio; // add audio element to playlist

					i = this.playlist[id];

					if (i.addEventListener) {
						i.addEventListener("canplay", function (e) {
							//BigBlockAudio.playlist[e.target.id].removeEventListener("canplay", BigBlockAudio.eventHandler, false);
							BigBlockAudio.playlist[e.target.id].removeEventListener("loadstart", BigBlockAudio.eventHandler, false);
							BigBlockAudio.playlist[e.target.id].removeEventListener("progress", BigBlockAudio.eventHandler, false);
							BigBlockAudio.playlist[e.target.id].removeEventListener("suspend", BigBlockAudio.eventHandler, false);
							BigBlockAudio.playlist[e.target.id].removeEventListener("abort", BigBlockAudio.eventHandler, false);
							BigBlockAudio.playlist[e.target.id].removeEventListener("error", BigBlockAudio.eventHandler, false);
							BigBlockAudio.playlist[e.target.id].removeEventListener("emptied", BigBlockAudio.eventHandler, false);				
							BigBlockAudio.playlist[e.target.id].removeEventListener("stalled", BigBlockAudio.eventHandler, false);
							if (after_load && typeof(after_load) === "function") {							
								BigBlockAudio.eventHandler(e, after_load(e));
							} else {
								BigBlockAudio.eventHandler(e);
							}
						}, false); // add canplay event listener
						i.addEventListener("loadstart", BigBlockAudio.eventHandler, false); // add loadstart event listener
						i.addEventListener("progress", BigBlockAudio.eventHandler, false); 
						i.addEventListener("suspend", BigBlockAudio.eventHandler, false); 
						i.addEventListener("abort", BigBlockAudio.eventHandler, false); 
						i.addEventListener("error", BigBlockAudio.eventHandler, false); 
						i.addEventListener("emptied", BigBlockAudio.eventHandler, false); 
						i.addEventListener("stalled", BigBlockAudio.eventHandler, false); 
					} else if (a.attachEvent) { // IE
						i.attachEvent("canplay", function (e) {BigBlockAudio.eventHandler(e, after_load);}, false);
						i.attachEvent("loadstart", BigBlockAudio.eventHandler, false);
						i.attachEvent("progress", BigBlockAudio.eventHandler, false); 
						i.attachEvent("suspend", BigBlockAudio.eventHandler, false); 
						i.attachEvent("abort", BigBlockAudio.eventHandler, false); 
						i.attachEvent("error", BigBlockAudio.eventHandler, false); 
						i.attachEvent("emptied", BigBlockAudio.eventHandler, false); 
						i.attachEvent("stalled", BigBlockAudio.eventHandler, false);					
					}

					if (i.load) {
						this.loading_list.push(id);						
						this.load_file(id); // load the file
						/*
						 * Firefox requires calling load() on the audio object. Safari seems to auto load the file, but does not throw an error calling load() directly.
						 */							
					} else {
						/*
						 * If the load() method does not exist, assume the Audio object is supported not but fully implemented.
						 * Delete the audio object from this.playlist.
						 */
						this.supported = false;	// will abort trying to load any further audio files
						this.playlist = [];				
						BigBlockAudio.Log("This browser does not support HTML5 audio.");	
					}

				} else {
					BigBlockAudio.Log("Audio mime-type " + mime_type + " not supported. " + this.format + " files will not be played.");
					if (BigBlockAudio.is_single_channel) { // if single channel
						BigBlockAudio.supported = false;	// will abort trying to load any further audio files
						BigBlockAudio.playlist = [];							
					}					
				}

			}

		},
		eventHandler: function (e, after_load) {

			var i, message;

			message = "An audio event for " + e.target.id + " just fired.";

			switch (e.type) {
				case "loadstart":
					message = "BigBlockAudio: eventHandler: Audio file " + e.target.id + " has started loading.";
					break;	
				case "progress":
					message = "BigBlockAudio: eventHandler: Audio file " + e.target.id + " is loading.";
					break;	
				case "suspend":
					message = "BigBlockAudio: eventHandler: The user agent is intentionally not currently fetching " + e.target.id + ", but does not have the entire media resource downloaded.";
					break;
				case "abort":
					message = "BigBlockAudio: eventHandler: The user agent stopped fetching " + e.target.id + " before it was completely downloaded, but not due to an error.";
					break;	
				case "error":
					message = "BigBlockAudio: eventHandler: An error occurred while fetching " + e.target.id + ".";
					if (BigBlockAudio.is_single_channel) {
						BigBlockAudio.supported = false;	// will abort trying to load any further audio files
						BigBlockAudio.playlist = [];							
					}					
					break;
				case "emptied":
					message = "BigBlockAudio: eventHandler: " + e.target.id + "'s network state just switched to NETWORK_EMPTY.";
					break;	
				case "stalled":
					message = "BigBlockAudio: eventHandler: The user agent is trying to fetch " + e.target.id + ", but data is unexpectedly not forthcoming.";					
					break;																															
				case "canplay":
					message = "BigBlockAudio: eventHandler: Audio file " + e.target.id + " is ready to play.";
					if (typeof(after_load) === "function" && !BigBlockAudio.loading_complete && BigBlockAudio.playlist[e.target.id].loaded) {
						setTimeout(function () {after_load();}, 0);
					}
					BigBlockAudio.playlist[e.target.id].loaded = true;
					break;
			}

			// remove file from loading array
			if (e.type !== "loadstart" && e.type !== "progress" && e.type !== "suspend" && e.type !== "emptied" && e.type !== "stalled") {
				for (i = 0; i < BigBlockAudio.loading_list.length; i++) {
					if (BigBlockAudio.loading_list[i] === e.target.id) {
						BigBlockAudio.loading_list.splice(i, 1);

						if (BigBlockAudio.loading_list.length < 1) {
							BigBlockAudio.loading_complete = true;
							if (BigBlockAudio.after_loading_complete && typeof(BigBlockAudio.after_loading_complete) === "function") {
								BigBlockAudio.after_loading_complete();
							}
 						}
						break;
					}			
				}
				BigBlockAudio.playlist[e.target.id].removeEventListener("loadstart", this.eventHandler, false);
				BigBlockAudio.playlist[e.target.id].removeEventListener("progress", this.eventHandler, false);
				BigBlockAudio.playlist[e.target.id].removeEventListener("suspend", this.eventHandler, false);
				BigBlockAudio.playlist[e.target.id].removeEventListener("abort", this.eventHandler, false);
				BigBlockAudio.playlist[e.target.id].removeEventListener("error", this.eventHandler, false);
				BigBlockAudio.playlist[e.target.id].removeEventListener("emptied", this.eventHandler, false);				
				BigBlockAudio.playlist[e.target.id].removeEventListener("stalled", this.eventHandler, false);
				//BigBlockAudio.playlist[e.target.id].removeEventListener("canplay", this.eventHandler, false);
			}

			if (BigBlockAudio.debug === true) {
				BigBlockAudio.Log(message);
			}															

		},
		/**
		 * Returns the empty string (a negative response), "maybe", or "probably" based on how confident the user agent is that it can play media resources of the given type.
		 * Allows the user agent to avoid downloading resources that use formats it cannot render.
		 * 
		 * @param {String} type
		 * 
		 */				
		canPlayType: function(element, type) {

			try {
				if (typeof(type) === "undefined") {
					throw new Error("A type is required");
				}															
			} catch(e) {
				BigBlockAudio.Log(e.name + ": " + e.message);
			}

			try {
				if (element.canPlayType) { // check that the browser supports the canPlayType method
					return element.canPlayType(type);
				} else {
					return "maybe";
				}						
			} catch(e) {
				BigBlockAudio.Log(e.name + ': ' + e.message);
			}

			return false;

		},		
		/**
		 * Causes the element to reset and start selecting and loading a new media resource from scratch.
		 * 
		 * @param {String} id
		 * 
		 */			
		load_file: function (id) {
						
			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio
					
				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}

				try {
					this.playlist[id].load(); // load the sound									
				} catch(e) {
					BigBlockAudio.Log(e.name + ': ' + e.message);
				}
			}
		},
		/**
		 * Plays an audio element.
		 * 
		 * @param {String} id
		 * 
		 */			
		play: function (id, before_play, after_play) {

			var duration, rs;

			if (this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}

				// rs;

				try {

					if (this.is_single_channel) { // single channel audio

						if (typeof(this.playlist[this.single_channel_id]) !== "undefined") {

							var time_now = new Date().getTime();
							if (time_now - this.last_play > this.last_play_delay) { // check that this.last_play_delay has passed

								rs = this.getReadyState(this.single_channel_id, true);

								if (rs.state >= 2 && this.muted === false) { // check that the sound is ready to play

									var start_time = this.track_labels[id].start_time;
									var duration = this.track_labels[id].duration;

									this.pause(this.single_channel_id); // pause the sound

									this.setCurrentTime(this.single_channel_id, start_time); // set the time to start playing
									
									if (before_play && typeof(before_play) === "function") { // run before_play
										before_play();
									}
									
									this.playlist[this.single_channel_id].play(); // play the sound
									this.last_play = time_now;

									this.pause_timeout = setTimeout(function () {
										BigBlockAudio.pause(BigBlockAudio.single_channel_id);
										if (after_play && typeof(after_play) === "function") { // run after_play
											after_play();
										}										
									}, duration);								

								} else {
									if (this.debug) {
										BigBlockAudio.Log("Audio: State: " + rs.state + " Message: " + rs.message);
									}
								}

							}

						}

					} else { // multi-channel audio

						if (typeof(this.playlist[id]) !== "undefined") {

							rs = this.getReadyState(id, true);

							if (rs.state >= 2 && this.muted === false) { // check that the sound is ready to play
								if (typeof(before_play) !== "undefined") {
									before_play();
								}
								if (typeof(after_play) !== "undefined") {
									duration = this.getDuration(id) * 1000;
									setTimeout(function () {
										after_play();
									}, duration);
								}
								this.playlist[id].pause();
								this.playlist[id].play();

							}

						}

					}

				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}
			}
		},
		/**
		 * Sets the paused attribute to true, loading the media resource if necessary.
		 * 
		 * @param {String} id
		 * 
		 */			
		pause: function (id, toggle) {

			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}

				var rs = this.getReadyState(id, true);

				if (rs.state > 2) { // check that the sound is ready

					if (typeof(toggle) !== "undefined") { // should this toggle bw paused/play
						if (this.isPaused(id) === false) {
							try {
								this.playlist[id].pause(); // pause the sound
							} catch(e) {
								BigBlockAudio.Log(e.name + ': ' + e.message);
							}							
						} else {
							var timeRanges = this.getPlayed(id);
							var ended = this.isEnded(id);
							if (timeRanges.length > 0 && ended !== true) { // if file has started playing and then paused; if file has not ended; start playing again
								try {
									this.playlist[id].play(); // play the sound
								} catch(e) {
									BigBlockAudio.Log(e.name + ': ' + e.message);
								}								
							}				
						}
					} else {
						try {
							this.playlist[id].pause(); // pause the sound										
						} catch(e) {
							BigBlockAudio.Log(e.name + ': ' + e.message);
						}					
					}

				} else {
					BigBlockAudio.Log("Audio: " + rs.message);
				}			
			}
		},
		/**
		 * Returns true if playback is paused; false otherwise.
		 * 
		 * @param {String} id
		 * 
		 */			
		isPaused: function (id) {

			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}

				try {
					return this.playlist[id].paused;							
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}			
			}
		},
		/**
		 * Returns a TimeRanges object that represents the ranges of the media resource that the user agent has played.
		 * 
		 * @param {String} id
		 * 
		 */			
		getPlayed: function (id) {
			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}

				try {
					return this.playlist[id].played;									
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}			
			}
		},
		/**
		 * Returns true if playback has reached the end of the media resource.
		 * 
		 * @param {String} id
		 * 
		 */			
		isEnded: function (id) {

			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}

				try {
					return this.playlist[id].ended;
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}			
			}
		},
		/**
		 * Returns the current rate playback, where 1.0 is normal speed.
		 * 
		 * @param {String} id
		 * 
		 */			
		getPlaybackRate: function (id) {

			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}

				try {
					return this.playlist[id].playbackRate;
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}			
			}
		},				
		/**
		 * Returns a value that expresses the current state of the element with respect to rendering the current playback position, from the codes in the list below.
		 * 
		 * @param {String} id
		 * @param {Boolean} debug
		 * 
		 */			
		getReadyState: function (id, debug) {

			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}

				var state = this.playlist[id].readyState; // get the ready state

				var val; // will be an object or integer depending on value of debug

				if (typeof(debug) !== "undefined") { // if debug has a value return the message along with the state value

					var message;

					switch (state) {
						case 0:
							message = "HAVE_NOTHING: No data for the current playback position is available.";												
							break;

						case 1:
							message = "HAVE_METADATA : Enough of the resource has been obtained that the duration of the resource is available. No media data is available for the immediate current playback position.";
							break;

						case 2:
							message = "HAVE_CURRENT_DATA: Data for the immediate current playback position is available, but not enough data is available to successfully advance the current playback position in the direction of playback.";
							break;

						case 3:
							message = "HAVE_FUTURE_DATA: Data for the immediate current playback position is available. However, not enough data is avaialble to determine if playback will out-pace the data stream.";
							break;

						case 4:
							message = "HAVE_ENOUGH_DATA: All data for the immediate current playback position is available.";
							break;					

					}

					val = {
						state : state,
						message : message
					};

				} else {

					val = state; 

				}

				return val;

			}

		},
		/**
		 * Returns the current state of network activity for the element, from the codes in the list below.
		 * 
		 * @param {String} id
		 * @param {Boolean} debug
		 * 
		 */			
		getNetworkState: function (id, debug) {

			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ': ' + e.message);
				}

				var state = this.playlist[id].networkState; // get the ready state
				var val; // will be an object or integer depending on value of debug

				if (typeof(debug) !== "undefined") { // if debug has a value return the message along with the state value

					var message;

					switch (state) {
						case 0:
							message = "NETWORK_EMPTY: The element has not yet been initialized. All attributes are in their initial states.";
							break;

						case 1:
							message = "NETWORK_IDLE: The element's resource selection algorithm is active and has selected a resource, but it is not actually using the network at this time.";
							break;

						case 2:
							message = "NETWORK_LOADING: The user agent is actively trying to download data.";
							break;

						case 3:
							message = "NETWORK_NO_SOURCE: The element's resource selection algorithm is active, but it has so not yet found a resource to use.";
							break;				

					}

					val = {
						state : state,
						message : message
					};

				} else {

					val = state; 

				}

				return val;

			}

		},				
		/**
		 * Returns the length of the media resource, in seconds, assuming that the start of the media resource is at time zero.
		 * Returns NaN if the duration isn't available.
		 * Returns Infinity for unbounded streams.
		 * 
		 * @param {String} id
		 * 
		 */			
		getDuration: function (id) {

			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ': ' + e.message);
				}

				try {
					return this.playlist[id].duration;										
				} catch(e) {
					BigBlockAudio.Log(e.name + ': ' + e.message);
				}			
			}
		},		
		/**
		 * Returns the current playback position, in seconds.
		 * Will throw an INVALID_STATE_ERR exception if there is no selected media resource.
		 * 
		 * @param {String} id
		 * 
		 */			
		getCurrentTime: function (id) {

			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}

				try {
					return this.playlist[id].currentTime;										
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}			
			}
		},		
		/**
		 * Sets the current playback position, in seconds.
		 * Will throw an INVALID_STATE_ERR exception if there is no selected media resource.
		 * Will throw an INDEX_SIZE_ERR exception if the given time is not within the ranges to which the user agent can seek.
		 * 
		 * @param {String} id
		 * @param {Number} time
		 */			
		setCurrentTime: function (id, time) {

			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}

				try {	
					this.playlist[id].currentTime = time;										
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}			
			}

		},		
		/**
		 * Returns the current playback volume, as a number in the range 0.0 to 1.0, where 0.0 is the quietest and 1.0 the loudest.
		 * 
		 * @param {String} id
		 * 
		 */			
		getVolume: function (id) {

			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}											
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}

				try {
					return this.playlist[id].volume;										
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}
			}
		},		
		/**
		 * Sets the current playback volume, as a number in the range 0.0 to 1.0, where 0.0 is the quietest and 1.0 the loudest.
		 * Throws an INDEX_SIZE_ERR if the new value is not in the range 0.0 .. 1.0.
		 * 
		 * @param {String} id
		 * @param {Number} volume
		 * 
		 */			
		setVolume: function (id, volume) {

			if (typeof(this.playlist[id]) !== "undefined" && this.supported) { // must be a valid audio file; browser must support HTML5 Audio

				try {
					if (typeof(id) === "undefined") {
						throw new Error("An id is required");
					}
					if (typeof(volume) === "undefined") {
						throw new Error("A volume value between 0.0 and 1.0 is required");
					}																
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}

				try {
					this.playlist[id].volume = volume;										
				} catch(e) {
					BigBlockAudio.Log(e.name + ": " + e.message);
				}			
			}
		},				
		/**
		 * Mutes all audio elements in playlist.
		 * 
		 * 
		 */			
		mute: function () {

			var i;

			if (this.supported) { // browser must support HTML5 Audio

				for (i in this.playlist) {
					if (this.playlist.hasOwnProperty(i)) {
						try {	
							this.playlist[i].muted = true; // mutes the sound						
						} catch(e) {
							BigBlockAudio.Log(e.name + ": " + e.message);
						}
					}			
				}

				this.muted = true;

			}

		},		
		/**
		 * Unmutes all audio elements in playlist.
		 * 
		 * 
		 */			
		unmute: function () {

			var i;

			if (this.supported) { // browser must support HTML5 Audio

				for (i in this.playlist) {
					if (this.playlist.hasOwnProperty(i)) {
						try {
							this.playlist[i].muted = false;	// unmutes the sound										
						} catch(e) {
							BigBlockAudio.Log(e.name + ": " + e.message);
						}
					}				
				}

				this.muted = false;

			}

		},
		Log: Log,
		getMimeTypeFromFileExt: function (ext) {
			try {
				if (typeof(ext) === "undefined") {
					throw new Error("BigBlock.getMimeTypeFromFileExt(ext): An extension is required.");
				} else {

					switch (ext) {
						case "aif":
							return ["audio/x-aiff", "audio/x-aiff"];
						case "au":
						case "snd":
							return ["audio/basic"];
						case "ogg":
							return ["audio/ogg"];			
						case "mp3":
							return ["audio/mpeg", "audio/x-mpeg"];																					
						case "wav":
							return ["audio/wav", "audio/x-wav"];
						default:
							return false;
					}			
				}								
			} catch(e) {
				BigBlock.Log.display(e.name + ": " + e.message);
			}			
		}
	};

}());