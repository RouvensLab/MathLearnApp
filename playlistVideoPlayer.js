// --- YouTube API Loader (ensures API is loaded only once) ---
        let youtubeApiPromise = null;
        function loadYouTubeIframeAPI() {
            if (youtubeApiPromise) return youtubeApiPromise;
            youtubeApiPromise = new Promise(resolve => {
                if (window.YT && window.YT.Player) {
                    resolve();
                    return;
                }
                window.onYouTubeIframeAPIReady = () => {
                    resolve();
                };
                const tag = document.createElement('script');
                tag.src = "https://www.youtube.com/iframe_api"; // YouTube IFrame API URL
                document.body.appendChild(tag);
            });
            return youtubeApiPromise;
        }

        // --- Helper Functions (can be moved to a separate utils.js if preferred) ---
        function parseISODuration(iso) {
            let m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
            if (!m) return 0;
            let h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), s = parseInt(m[3] || 0);
            return h * 3600 + min * 60 + s;
        }

        function formatDuration(seconds) {
            if (isNaN(seconds) || seconds < 0) return "0:00"; // Default to 0:00 for invalid/negative
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            const parts = [];
            if (h > 0) parts.push(`${h}`);
            parts.push(`${m < 10 && h > 0 ? '0' : ''}${m}`); // Add leading zero if > 1hr
            parts.push(`${s < 10 ? '0' : ''}${s}`);
            return parts.join(':');
        }

        async function parseInput(input, fetchPlaylistVideos) {
            let lines = input.split('\n').map(l => l.trim()).filter(Boolean);
            let videoIds = [];
            for (let line of lines) {
                if (line.includes('playlist?list=')) {
                    let listId = (line.match(/list=([a-zA-Z0-9_-]+)/) || [])[1];
                    if (listId) {
                        let idsFromPlaylist = await fetchPlaylistVideos(listId);
                        videoIds.push(...idsFromPlaylist);
                    }
                } else if (line.includes('youtu')) {
                    let vid = null;
                    let m = line.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
                    if (m) vid = m[1];
                    m = line.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || line.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
                    if (m) vid = m[1];
                    if (vid) videoIds.push(vid);
                }
            }
            return videoIds;
        }


// --- PlaylistVideoPlayer Class ---
        class PlaylistVideoPlayer {
            /**
             * @param {HTMLElement} targetElement - The DOM element where the player will be rendered.
             * @param {string} urlsString - Newline-separated YouTube video or playlist URLs.
             * @param {Object} options - Configuration options.
             * @param {number} [options.initialProgress=0] - Starting progress (0-1) across the entire playlist.
             * @param {string} [options.ytApiKey=""] - YouTube Data API v3 key for playlist support.
             * @param {boolean} [options.enableFullscreen=true] - Whether the fullscreen button is shown.
             * @param {number} [options.hideControlsDelay=3000] - Delay in ms before controls fade.
             * @param {boolean} [options.paused=false] - Whether to start paused.
             */
            constructor(targetElement, urlsString, options = {}) {
                if (!(targetElement instanceof HTMLElement)) {
                    console.error("PlaylistVideoPlayer: targetElement must be a valid HTMLElement.");
                    return;
                }

                this.targetElement = targetElement;
                this.urlsString = urlsString;
                this.options = {
                    initialProgress: 0,
                    ytApiKey: "",
                    enableFullscreen: true,
                    hideControlsDelay: 3000,
                    paused: false,
                    ...options
                };

                this.videoQueue = [];
                this.videoDurations = [];
                this.totalDuration = 0;
                this.currentIndex = 0;
                this.player = null;
                this.progressInterval = null;
                this.seeking = false;
                this.controlsTimeout = null;
                this.isFullScreen = false; // Track fullscreen state

                this._render();
                loadYouTubeIframeAPI().then(() => this._init());
            }

            _render() {
                this.targetElement.innerHTML = `
                    <div id="pvplayer-wrapper" class="w-full h-full relative">
                        <div id="pvplayer-iframe" class="absolute inset-0 w-full h-full"></div>
                        <div id="pv-controls-overlay" class="absolute inset-0 flex flex-col justify-end p-4 z-10 opacity-0 transition-opacity duration-300 pointer-events-none">
                            <div id="pv-controls" class="flex items-center gap-2 mb-2 p-2 bg-black bg-opacity-50 rounded-lg pointer-events-auto">
                                <button id="pvplaypause" class="w-9 h-9 border-none bg-gray-600 rounded-full flex items-center justify-center cursor-pointer text-lg text-white
                                                                transition-colors duration-200 hover:bg-gray-700">
                                    ▶
                                </button>
                                <div id="pvprogressbar-bg" class="flex-1 w-full h-3 bg-gray-600 rounded-full overflow-hidden cursor-pointer relative">
                                    <div id="pvprogressbar" class="h-full progressbar-gradient w-0 transition-all duration-200 ease-linear"></div>
                                    <div id="pvprogressdot" class="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-[18px] h-[18px] bg-white border-[3px] border-red-600 rounded-full shadow-md pointer-events-auto cursor-pointer transition-all duration-200"></div>
                                </div>
                                <span id="pvtimeinfo" class="text-xs text-gray-200 whitespace-nowrap">0:00 / 0:00</span>
                                ${this.options.enableFullscreen ? `
                                <button id="pvfullscreen" class="w-9 h-9 border-none bg-gray-600 rounded-full flex items-center justify-center cursor-pointer text-lg text-white
                                                                transition-colors duration-200 hover:bg-gray-700">
                                    ⤢
                                </button>
                                ` : ''}
                            </div>
                            <div id="pvstatus" class="text-center text-gray-400 text-sm min-h-[20px] pointer-events-none"></div>
                        </div>
                    </div>
                `;

                this.playerWrapper = this.targetElement.querySelector('#pvplayer-wrapper');
                this.playerIframeElement = this.targetElement.querySelector('#pvplayer-iframe');
                this.controlsOverlay = this.targetElement.querySelector('#pv-controls-overlay');
                this.progressBarBg = this.targetElement.querySelector('#pvprogressbar-bg');
                this.progressBar = this.targetElement.querySelector('#pvprogressbar');
                this.progressDot = this.targetElement.querySelector('#pvprogressdot');
                this.playPauseBtn = this.targetElement.querySelector('#pvplaypause');
                this.timeInfoSpan = this.targetElement.querySelector('#pvtimeinfo');
                this.statusSpan = this.targetElement.querySelector('#pvstatus');
                this.fullscreenBtn = this.targetElement.querySelector('#pvfullscreen');

                // Event Listeners
                this.progressBarBg.addEventListener('mousedown', this._onSeekStart.bind(this));
                this.progressBarBg.addEventListener('touchstart', this._onSeekStart.bind(this), {passive:false});
                this.progressDot.addEventListener('mousedown', (e) => { e.stopPropagation(); this._onSeekStart(e, true); });
                this.progressDot.addEventListener('touchstart', (e) => { e.stopPropagation(); this._onSeekStart(e, true); }, {passive:false});
                this.playPauseBtn.addEventListener('click', this._onPlayPause.bind(this));

                if (this.options.enableFullscreen && this.fullscreenBtn) {
                    this.fullscreenBtn.addEventListener('click', this.toggleFullscreen.bind(this));
                    document.addEventListener('fullscreenchange', this._handleFullscreenChange.bind(this));
                    document.addEventListener('webkitfullscreenchange', this._handleFullscreenChange.bind(this));
                    document.addEventListener('mozfullscreenchange', this._handleFullscreenChange.bind(this));
                    document.addEventListener('MSFullscreenChange', this._handleFullscreenChange.bind(this));
                }

                // Controls fading logic
                this.playerWrapper.addEventListener('mousemove', this._showControls.bind(this));
                this.playerWrapper.addEventListener('mouseleave', this._hideControls.bind(this));
                this.playerWrapper.addEventListener('touchstart', this._showControls.bind(this), {passive:false}); // Show on first touch
                this.playerWrapper.addEventListener('touchend', this._hideControls.bind(this)); // Hide after touch interaction ends

                // Initial show for a few seconds
                this._showControls();
            }

            async _init() {
                this._setStatus("Loading videos...");
                this.videoQueue = await parseInput(this.urlsString, this._fetchPlaylistVideos.bind(this));
                if (this.videoQueue.length === 0) {
                    this._setStatus("No valid YouTube video or playlist URLs found.");
                    return;
                }
                this._setStatus(`Fetching durations for ${this.videoQueue.length} videos...`);
                this.videoDurations = await this._fetchVideoDurations(this.videoQueue);
                this.totalDuration = this.videoDurations.reduce((a, b) => a + b, 0);

                // Find start index and offset based on initial progress
                let startSeconds = this.options.initialProgress * this.totalDuration;
                let acc = 0, idx = 0;
                for (; idx < this.videoDurations.length; ++idx) {
                    if (acc + this.videoDurations[idx] > startSeconds) break;
                    acc += this.videoDurations[idx];
                }
                this.currentIndex = Math.min(idx, this.videoQueue.length - 1);
                this._setStatus(`Ready to play ${this.videoQueue.length} videos. Total duration: ${formatDuration(this.totalDuration)}`);
                // Pass pause option to _loadVideo
                this._loadVideo(this.currentIndex, Math.max(0, startSeconds - acc), this.options.paused);
                this._startProgress();
            }

            async _fetchPlaylistVideos(listId) {
                if (!this.options.ytApiKey) {
                    this._setStatus("Playlist support requires a YouTube Data API key. Only single videos will be loaded.");
                    return [];
                }
                let ids = [];
                let nextPage = '';
                try {
                    do {
                        let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&playlistId=${listId}&key=${this.options.ytApiKey}${nextPage ? '&pageToken=' + nextPage : ''}`;
                        let resp = await fetch(url);
                        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
                        let data = await resp.json();
                        if (data.items) {
                            ids.push(...data.items.map(item => item.contentDetails.videoId));
                        }
                        nextPage = data.nextPageToken;
                    } while (nextPage);
                } catch (error) {
                    this._setStatus(`Error loading playlist: ${error.message}. Please check your API key and network.`);
                    return [];
                }
                return ids;
            }

            async _fetchVideoDurations(ids) {
                if (!this.options.ytApiKey) {
                    this._setStatus("No YouTube Data API key. Using default video durations (5 minutes each).");
                    return Array(ids.length).fill(300);
                }
                let durations = [];
                try {
                    for (let i = 0; i < ids.length; i += 50) {
                        let batch = ids.slice(i, i + 50);
                        let url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${batch.join(',')}&key=${this.options.ytApiKey}`;
                        let resp = await fetch(url);
                        if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
                        let data = await resp.json();
                        if (data.items) {
                            durations.push(...data.items.map(item => parseISODuration(item.contentDetails.duration)));
                        }
                    }
                } catch (error) {
                    this._setStatus(`Error fetching durations: ${error.message}. Using default durations.`);
                    return Array(ids.length).fill(300); // Fallback to default duration on error
                }
                return durations;
            }

            _setStatus(msg) {
                this.statusSpan.textContent = msg;
            }

            _updateTimeInfo(elapsed, total) {
                this.timeInfoSpan.textContent = `${formatDuration(elapsed)} / ${formatDuration(total)}`;
            }

            _loadVideo(idx, seekSeconds = 0, pauseOnLoad = false) {
                if (idx >= this.videoQueue.length) {
                    this._setStatus("Playlist finished!");
                    clearInterval(this.progressInterval);
                    this._updateProgressBar(1); // Set progress to 100%
                    this._updateTimeInfo(this.totalDuration, this.totalDuration);
                    if (this.player) {
                        this.player.destroy();
                        this.player = null;
                    }
                    this.currentIndex = 0; // Reset for next play
                    this.playPauseBtn.textContent = "▶"; // Ensure button is 'play'
                    this._showControls(); // Keep controls visible at end
                    return;
                }
                const videoIdToLoad = this.videoQueue[idx];
                this.currentIndex = idx; // Update current index
                this._setStatus(`Playing video ${idx + 1} of ${this.videoQueue.length}: ${videoIdToLoad}`);

                if (this.player) {
                    this.player.loadVideoById({videoId: videoIdToLoad, startSeconds: seekSeconds || 0});
                    if (pauseOnLoad) {
                        setTimeout(() => {
                            if (this.player && typeof this.player.pauseVideo === "function") {
                                this.player.pauseVideo();
                            }
                        }, 500);
                    }
                } else {
                    this.player = new YT.Player(this.playerIframeElement, {
                        videoId: videoIdToLoad,
                        playerVars: {
                            autoplay: pauseOnLoad ? 0 : 1,
                            controls: 0,
                            rel: 0,
                            modestbranding: 1,
                            iv_load_policy: 3
                        },
                        events: {
                            'onReady': (event) => {
                                if (seekSeconds > 0) {
                                    event.target.seekTo(seekSeconds, true);
                                }
                                if (pauseOnLoad) {
                                    event.target.pauseVideo();
                                } else {
                                    event.target.playVideo();
                                }
                            },
                            'onStateChange': this._onPlayerStateChange.bind(this),
                            'onError': this._onPlayerError.bind(this)
                        }
                    });
                }
            }

            _onPlayerStateChange(event) {
                if (event.data === YT.PlayerState.ENDED) {
                    this.playPauseBtn.textContent = "▶";
                    this.currentIndex++;
                    this._loadVideo(this.currentIndex, 0); // Load next video from the beginning
                } else if (event.data === YT.PlayerState.PLAYING) {
                    this.playPauseBtn.textContent = "⏸";
                    this._startProgress();
                    this._hideControls(); // Hide controls after play starts
                } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
                    this.playPauseBtn.textContent = "▶";
                    clearInterval(this.progressInterval);
                    this._showControls(); // Show controls when paused
                }
            }

            _onPlayerError(event) {
                console.error("YouTube Player Error:", event.data);
                let errorMessage = "Unknown error.";
                switch (event.data) {
                    case 2: errorMessage = "Invalid video ID or restricted content."; break;
                    case 5: errorMessage = "HTML5 player error."; break;
                    case 100: errorMessage = "Video not found."; break;
                    case 101:
                    case 150: errorMessage = "Video cannot be played in an embedded player (e.g., copyright or region restriction)."; break;
                }
                this._setStatus(`Player Error: ${errorMessage}. Skipping video.`);
                this.currentIndex++;
                this._loadVideo(this.currentIndex, 0);
            }

            _startProgress() {
                clearInterval(this.progressInterval);
                this.progressInterval = setInterval(() => {
                    if (this.seeking || !this.player || typeof this.player.getCurrentTime !== 'function' || !this.totalDuration) {
                        return;
                    }

                    let currentVideoTime = this.player.getCurrentTime();
                    let elapsedGlobal = 0;
                    for (let i = 0; i < this.currentIndex; ++i) {
                        elapsedGlobal += this.videoDurations[i] || 0;
                    }
                    elapsedGlobal += currentVideoTime;

                    let progress = Math.min(elapsedGlobal / this.totalDuration, 1);
                    this._updateProgressBar(progress);
                    this._updateTimeInfo(elapsedGlobal, this.totalDuration);

                }, 200);
            }

            _updateProgressBar(progress) {
                if (!this.progressBar || !this.progressDot || !this.progressBarBg) return;

                this.progressBar.style.width = (progress * 100) + "%";
                const barWidth = this.progressBarBg.offsetWidth;
                const dotPosition = Math.max(0, Math.min(1, progress)) * barWidth;
                this.progressDot.style.left = dotPosition + "px";
            }

            _onSeekStart(e, isDot = false) {
                e.preventDefault();
                this.seeking = true;
                this._showControls(true); // Keep controls visible during seek

                let moveHandler;
                let upHandler;

                moveHandler = this._onSeekMove.bind(this);
                upHandler = (event) => {
                    this._onSeekEnd(moveHandler, upHandler, event);
                };

                document.addEventListener('mousemove', moveHandler);
                document.addEventListener('mouseup', upHandler);
                document.addEventListener('touchmove', moveHandler, {passive:false});
                document.addEventListener('touchend', upHandler);

                if (!isDot) {
                    this._onSeekMove(e);
                }
            }

            _onSeekMove(e) {
                if (!this.seeking || !this.totalDuration) return;

                let clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
                const rect = this.progressBarBg.getBoundingClientRect();
                let x = clientX - rect.left;
                x = Math.max(0, Math.min(rect.width, x));

                let percent = x / rect.width;
                this._updateProgressBar(percent);

                let seekSeconds = percent * this.totalDuration;
                this._updateTimeInfo(seekSeconds, this.totalDuration); // Update time info during seek
            }

            _onSeekEnd(moveHandler, upHandler, e) {
                this.seeking = false;
                document.removeEventListener('mousemove', moveHandler);
                document.removeEventListener('mouseup', upHandler);
                document.removeEventListener('touchmove', moveHandler);
                document.removeEventListener('touchend', upHandler);

                let clientX = (e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0].clientX : e.clientX;
                const rect = this.progressBarBg.getBoundingClientRect();
                let x = clientX - rect.left;
                x = Math.max(0, Math.min(rect.width, x));
                let percent = x / rect.width;

                let seekSeconds = percent * this.totalDuration;
                let acc = 0, idx = 0;

                for (; idx < this.videoDurations.length; ++idx) {
                    if (acc + this.videoDurations[idx] > seekSeconds) {
                        break;
                    }
                    acc += this.videoDurations[idx];
                }

                this.currentIndex = Math.min(idx, this.videoQueue.length - 1);
                let offset = Math.max(0, seekSeconds - acc);

                this._loadVideo(this.currentIndex, offset);
                this._setStatus(`Seeked to ${formatDuration(seekSeconds)} (${Math.round(percent * 100)}%)`);

                if (this.player && this.player.getPlayerState() === YT.PlayerState.PLAYING) {
                    this._hideControls(); // Hide controls if playing after seek
                } else {
                    this._showControls(); // Keep controls visible if paused after seek
                }
                this._startProgress();
            }

            _onPlayPause() {
                if (!this.player) return;
                if (this.player.getPlayerState() === YT.PlayerState.PLAYING) {
                    this.player.pauseVideo();
                    this.playPauseBtn.textContent = "▶";
                } else {
                    this.player.playVideo();
                    this.playPauseBtn.textContent = "⏸";
                }
            }

            // --- Controls Fading ---
            _showControls(noTimeout = false) {
                clearTimeout(this.controlsTimeout);
                if (this.controlsOverlay) {
                    this.controlsOverlay.style.opacity = '1';
                    this.controlsOverlay.style.pointerEvents = 'auto'; // Re-enable pointer events on controls
                }
                if (!noTimeout && this.player && this.player.getPlayerState() === YT.PlayerState.PLAYING && !this.seeking) {
                    this.controlsTimeout = setTimeout(() => {
                        this._hideControls();
                    }, this.options.hideControlsDelay);
                }
            }

            _hideControls() {
                if (this.controlsOverlay && this.player && this.player.getPlayerState() === YT.PlayerState.PLAYING && !this.seeking) {
                    this.controlsOverlay.style.opacity = '0';
                    this.controlsOverlay.style.pointerEvents = 'none'; // Disable pointer events when hidden
                }
            }

            // --- Fullscreen Logic ---
            toggleFullscreen() {
                if (!this.options.enableFullscreen) return;

                if (!document.fullscreenElement &&    // standard
                    !document.mozFullScreenElement && // Firefox
                    !document.webkitFullscreenElement && // Chrome, Safari and Opera
                    !document.msFullscreenElement) {  // IE/Edge
                    if (this.playerWrapper.requestFullscreen) {
                        this.playerWrapper.requestFullscreen();
                    } else if (this.playerWrapper.mozRequestFullScreen) { /* Firefox */
                        this.playerWrapper.mozRequestFullScreen();
                    } else if (this.playerWrapper.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
                        this.playerWrapper.webkitRequestFullscreen();
                    } else if (this.playerWrapper.msRequestFullscreen) { /* IE/Edge */
                        this.playerWrapper.msRequestFullscreen();
                    }
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.mozCancelFullScreen) { /* Firefox */
                        document.mozCancelFullScreen();
                    } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
                        document.webkitExitFullscreen();
                    } else if (document.msExitFullscreen) { /* IE/Edge */
                        document.msExitFullscreen();
                    }
                }
            }

            _handleFullscreenChange() {
                this.isFullScreen = !!(document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
                if (this.isFullScreen) {
                    this.playerWrapper.classList.add('fullscreen');
                    if (this.fullscreenBtn) this.fullscreenBtn.textContent = '縮'; // Shrink icon
                } else {
                    this.playerWrapper.classList.remove('fullscreen');
                    if (this.fullscreenBtn) this.fullscreenBtn.textContent = '⤢'; // Expand icon
                    this._hideControls(); // Re-hide controls after exiting fullscreen if playing
                }
            }

            /**
             * Public method to manually load a new set of URLs.
             * @param {string} newUrlsString - Newline-separated YouTube video/playlist URLs.
             * @param {number} [newInitialProgress=0] - Starting progress (0-1).
             */
            async loadNewUrls(newUrlsString, newInitialProgress = 0, paused = false) {
                this.urlsString = newUrlsString;
                this.options.initialProgress = newInitialProgress;
                this.options.paused = paused;

                // Cleanup existing player if any
                clearInterval(this.progressInterval);
                if (this.player) {
                    this.player.destroy();
                    this.player = null;
                }

                // Re-initialize with new URLs and progress
                await this._init();
            }
        }