Module.register("MMM-SunSigns", {
    defaults: {
        zodiacSign: ["taurus"],
        period: ["daily"],
        showImage: true,
        imageWidth: "100px",
        maxTextHeight: "400px",
        width: "400px",
        fontSize: "1em",
        debug: true,
        retryDelay: 60000, // 1 minute
        initialLoadTimeout: 30000, // 30 seconds
        signWaitTime: 120000, // 2 minutes (default)
        pauseDuration: 10000, // 10 seconds (default)
        scrollSpeed: 7 // pixels per second (default)
    },

    start: function() {
        Log.info("Starting module: " + this.name);
        this.horoscopes = {};
        this.currentSignIndex = 0;
        this.currentPeriodIndex = 0;
        this.loaded = false;
        this.isScrolling = false;
        this.lastUpdateAttempt = null;
        this.updateFailures = 0;

        this.scheduleUpdate(1000);
    },

    getStyles: function() {
        return ["MMM-SunSigns.css"];
    },

    scheduleUpdate: function(delay) {
        var self = this;
        setTimeout(function() {
            self.updateHoroscopes();
        }, delay);
    },

    updateHoroscopes: function() {
        this.lastUpdateAttempt = new Date().toLocaleString();
        this.sendSocketNotification("UPDATE_HOROSCOPES", {
            zodiacSigns: this.config.zodiacSign,
            periods: this.config.period,
            signWaitTime: this.config.signWaitTime,
            pauseDuration: this.config.pauseDuration,
            scrollSpeed: this.config.scrollSpeed
        });

        // Set a timeout for initial load
        if (!this.loaded) {
            setTimeout(() => {
                if (!this.loaded) {
                    Log.error(this.name + ": Initial load timeout reached. Retrying...");
                    this.updateFailures++;
                    this.scheduleUpdate(this.config.retryDelay);
                }
            }, this.config.initialLoadTimeout);
        }
    },

    getDom: function() {
        var wrapper = document.createElement("div");
        wrapper.className = "MMM-SunSigns";
        wrapper.style.width = this.config.width;
        wrapper.style.fontSize = this.config.fontSize;

        if (!this.loaded) {
            wrapper.innerHTML = "Loading horoscope...";
            if (this.config.debug) {
                wrapper.innerHTML += "<br>Last attempt: " + this.lastUpdateAttempt;
                wrapper.innerHTML += "<br>Update failures: " + this.updateFailures;
            }
            return wrapper;
        }

        var slideContainer = document.createElement("div");
        slideContainer.className = "sunsigns-slide-container";

        // Calculate total number of slides
        var totalSlides = this.config.zodiacSign.length * this.config.period.length;

        // Calculate current overall index
        var currentOverallIndex = this.currentSignIndex * this.config.period.length + this.currentPeriodIndex;
        var nextOverallIndex = (currentOverallIndex + 1) % totalSlides;

        // Create current slide
        var currentSign = this.config.zodiacSign[this.currentSignIndex];
        var currentPeriod = this.config.period[this.currentPeriodIndex];
        slideContainer.appendChild(this.createSignElement(currentSign, "current", currentPeriod));

        // Create next slide
        var nextSignIndex = Math.floor(nextOverallIndex / this.config.period.length);
        var nextPeriodIndex = nextOverallIndex % this.config.period.length;
        var nextSign = this.config.zodiacSign[nextSignIndex];
        var nextPeriod = this.config.period[nextPeriodIndex];
        slideContainer.appendChild(this.createSignElement(nextSign, "next", nextPeriod));

        wrapper.appendChild(slideContainer);

        if (this.config.debug) {
            var debugInfo = document.createElement("div");
            debugInfo.className = "small dimmed";
            debugInfo.innerHTML = `Last Update: ${this.lastUpdateAttempt}<br>
                                   Update Failures: ${this.updateFailures}`;
            wrapper.appendChild(debugInfo);
        }

        return wrapper;
    },

    createSignElement: function(sign, className, period) {
        var slideWrapper = document.createElement("div");
        slideWrapper.className = "sunsigns-slide-wrapper " + className;

        var contentWrapper = document.createElement("div");
        contentWrapper.className = "sunsigns-content-wrapper";

        var textContent = document.createElement("div");
        textContent.className = "sunsigns-text-content";

        var periodText = document.createElement("div");
        periodText.className = "sunsigns-period";
        periodText.innerHTML = this.formatPeriodText(period) + " Horoscope for " + sign.charAt(0).toUpperCase() + sign.slice(1);
        textContent.appendChild(periodText);

        var horoscopeWrapper = document.createElement("div");
        horoscopeWrapper.className = "sunsigns-text-wrapper";
        horoscopeWrapper.style.maxHeight = this.config.maxTextHeight;

        var horoscopeTextElement = document.createElement("div");
        horoscopeTextElement.className = "sunsigns-text";
        horoscopeTextElement.innerHTML = this.horoscopes[sign] && this.horoscopes[sign][period] 
            ? this.horoscopes[sign][period] 
            : "Loading " + period + " horoscope for " + sign + "...";
        horoscopeWrapper.appendChild(horoscopeTextElement);

        textContent.appendChild(horoscopeWrapper);
        contentWrapper.appendChild(textContent);

        if (this.config.showImage) {
            var imageWrapper = document.createElement("div");
            imageWrapper.className = "sunsigns-image-wrapper";
            var image = document.createElement("img");
            image.src = `https://www.sunsigns.com/wp-content/themes/sunsigns/assets/images/_sun-signs/${sign}/wrappable.png`;
            image.alt = sign + " zodiac sign";
            image.style.width = this.config.imageWidth;
            imageWrapper.appendChild(image);
            contentWrapper.appendChild(imageWrapper);
        }

        slideWrapper.appendChild(contentWrapper);

        return slideWrapper;
    },

    formatPeriodText: function(period) {
        if (period === "tomorrow") {
            return "Tomorrow's";
        }
        return period.charAt(0).toUpperCase() + period.slice(1);
    },

    scheduleRotation: function() {
        if (this.config.zodiacSign.length === 1 && this.config.period.length === 1) {
            // Don't schedule rotation for single sign and period
            return;
        }

        var self = this;
        this.rotationTimer = setTimeout(function() {
            self.rotateHoroscope();
        }, this.config.signWaitTime);
    },

    rotateHoroscope: function() {
        var slideContainer = document.querySelector(".MMM-SunSigns .sunsigns-slide-container");
        if (slideContainer) {
            slideContainer.classList.add("sliding");
            
            setTimeout(() => {
                this.currentPeriodIndex++;
                if (this.currentPeriodIndex >= this.config.period.length) {
                    this.currentPeriodIndex = 0;
                    this.currentSignIndex = (this.currentSignIndex + 1) % this.config.zodiacSign.length;
                }
                this.updateDom(0); // Update DOM immediately
                slideContainer.classList.remove("sliding");
            }, 1000); // This should match the CSS transition duration
        }
        this.scheduleRotation();
    },

    socketNotificationReceived: function(notification, payload) {
        if (notification === "HOROSCOPE_RESULT") {
            Log.info(this.name + ": Received horoscope result", payload);
            if (payload.success) {
                if (!this.horoscopes[payload.sign]) {
                    this.horoscopes[payload.sign] = {};
                }
                this.horoscopes[payload.sign][payload.period] = payload.data;
                this.loaded = true;
                this.updateFailures = 0;
                this.updateDom();
                this.scheduleRotation();
            } else {
                Log.error(this.name + ": Failed to fetch horoscope", payload);
                this.updateFailures++;
                this.scheduleUpdate(this.config.retryDelay);
            }
        } else if (notification === "ERROR") {
            Log.error(this.name + ": Received error notification", payload);
            this.updateFailures++;
            this.scheduleUpdate(this.config.retryDelay);
        }
    },

    startScrolling: function() {
        var self = this;
        clearTimeout(this.scrollTimer);

        this.scrollTimer = setTimeout(function() {
            var textWrapper = document.querySelector(".MMM-SunSigns .sunsigns-text-wrapper");
            var textContent = document.querySelector(".MMM-SunSigns .sunsigns-text");

            if (textWrapper && textContent) {
                var wrapperHeight = textWrapper.offsetHeight;
                var contentHeight = textContent.offsetHeight;

                if (contentHeight > wrapperHeight) {
                    self.isScrolling = true;
                    var scrollDistance = contentHeight - wrapperHeight;
                    var verticalDuration = (scrollDistance / self.config.scrollSpeed) * 1000; // Use configurable scroll speed

                    setTimeout(() => {
                        textContent.style.transition = `transform ${verticalDuration}ms linear`;
                        textContent.style.transform = `translateY(-${scrollDistance}px)`;

                        setTimeout(() => {
                            textContent.style.transition = 'none';
                            textContent.style.transform = 'translateY(0)';

                            void textContent.offsetWidth;

                            self.isScrolling = false;

                            setTimeout(() => {
                                self.startScrolling();
                            }, 500);
                        }, verticalDuration + self.config.pauseDuration); // Use configurable pause duration
                    }, self.config.pauseDuration); // Use configurable pause duration
                } else {
                    self.isScrolling = false;
                }
            }
        }, 1000);
    }
});
