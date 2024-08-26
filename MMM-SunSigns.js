Module.register("MMM-SunSigns", {
    defaults: {
        zodiacSign: ["taurus"],
        periods: ["daily","tomorrow"],
        requestTimeout: 30000,
        signWaitTime: 120000,
        showImage: true,
        imageWidth: "100px",
        pauseDuration: 10000,
        scrollSpeed: 7,
        maxTextHeight: "400px",
        width: "400px",
        fontSize: "1em",
        updateInterval: 60 * 60 * 1000,
        retryDelay: 300000,
        maxRetries: 5
    },

    start: function() {
        Log.info("Starting module: " + this.name);
        this.horoscopes = {};
        this.currentSignIndex = 0;
        this.currentPeriodIndex = 0;
        this.loaded = false;
        this.isScrolling = false;
        this.scheduleUpdate(1000);
        this.scheduleRotation();
    },

    getStyles: function() {
        return ["MMM-SunSigns.css"];
    },

    getDom: function() {
        var wrapper = document.createElement("div");
        wrapper.className = "MMM-SunSigns";
        wrapper.style.width = this.config.width;
        wrapper.style.fontSize = this.config.fontSize;

        if (!this.loaded) {
            wrapper.innerHTML = "Loading horoscope...";
            return wrapper;
        }

        if (this.config.zodiacSign.length === 1 && this.config.periods.length === 1) {
            wrapper.classList.add("single-sign");
            wrapper.appendChild(this.createSignElement(this.config.zodiacSign[0], "single"));
        } else {
            wrapper.classList.add("multiple-signs");
            var slideContainer = document.createElement("div");
            slideContainer.className = "sunsigns-slide-container";

            var currentSign = this.config.zodiacSign[this.currentSignIndex];
            var currentPeriod = this.config.periods[this.currentPeriodIndex];
            var nextSignIndex = (this.currentSignIndex + 1) % this.config.zodiacSign.length;
            var nextPeriodIndex = (this.currentPeriodIndex + 1) % this.config.periods.length;
            var nextSign = nextPeriodIndex === 0 ? this.config.zodiacSign[nextSignIndex] : currentSign;
            var nextPeriod = this.config.periods[nextPeriodIndex];

            slideContainer.appendChild(this.createSignElement(currentSign, "current", currentPeriod));
            slideContainer.appendChild(this.createSignElement(nextSign, "next", nextPeriod));

            wrapper.appendChild(slideContainer);
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

    scheduleUpdate: function(delay) {
        var self = this;
        var nextLoad = this.config.updateInterval;
        if (typeof delay !== "undefined" && delay >= 0) {
            nextLoad = delay;
        }

        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(function() {
            self.updateHoroscopes();
        }, nextLoad);
    },

    updateHoroscopes: function() {
        this.config.zodiacSign.forEach(sign => {
            this.config.periods.forEach(period => {
                this.getHoroscope(sign, period);
            });
        });
        this.scheduleUpdate(this.config.updateInterval);
    },

    getHoroscope: function(sign, period) {
        Log.info(this.name + ": Requesting horoscope update for " + sign + ", period: " + period);
        this.sendSocketNotification("GET_HOROSCOPE", {
            sign: sign,
            period: period,
            timeout: this.config.requestTimeout,
            retryDelay: this.config.retryDelay,
            maxRetries: this.config.maxRetries
        });
    },

    scheduleRotation: function() {
        var self = this;
        this.rotationTimer = setTimeout(function() {
            self.checkAndRotate();
        }, this.config.signWaitTime);
    },

    checkAndRotate: function() {
        if (!this.isScrolling) {
            this.slideToNext();
        } else {
            setTimeout(() => this.checkAndRotate(), 1000);
        }
    },

    slideToNext: function() {
        var container = document.querySelector(".MMM-SunSigns .sunsigns-slide-container");
        if (container) {
            container.style.transition = "transform 1s ease-in-out";
            container.style.transform = "translateX(-50%)";
            
            setTimeout(() => {
                this.currentPeriodIndex = (this.currentPeriodIndex + 1) % this.config.periods.length;
                if (this.currentPeriodIndex === 0) {
                    this.currentSignIndex = (this.currentSignIndex + 1) % this.config.zodiacSign.length;
                }
                container.style.transition = "none";
                container.style.transform = "translateX(0)";
                this.updateDom(0);
                this.startScrolling();
                this.scheduleRotation();
            }, 1000);
        }
    },

    socketNotificationReceived: function(notification, payload) {
        console.log(this.name + ": Received socket notification:", notification, payload);
        if (notification === "HOROSCOPE_RESULT") {
            if (payload.success) {
                Log.info(this.name + ": Horoscope fetched successfully for " + payload.sign + ", period: " + payload.period);
                if (!this.horoscopes[payload.sign]) {
                    this.horoscopes[payload.sign] = {};
                }
                this.horoscopes[payload.sign][payload.period] = payload.data;
                this.loaded = true;
                if (payload.sign === this.config.zodiacSign[this.currentSignIndex] &&
                    payload.period === this.config.periods[this.currentPeriodIndex]) {
                    this.updateDom();
                    this.startScrolling();
                }
            } else {
                Log.error(this.name + ": " + payload.message);
                if (!this.horoscopes[payload.sign]) {
                    this.horoscopes[payload.sign] = {};
                }
                this.horoscopes[payload.sign][payload.period] = "Unable to fetch " + payload.period + " horoscope for " + payload.sign + ". Error: " + (payload.error || "Unknown error");
                this.updateDom();
            }
        } else if (notification === "UNHANDLED_ERROR") {
            Log.error(this.name + ": Unhandled error in node helper: " + payload.message + ". Error: " + payload.error);
            this.horoscopes[this.config.zodiacSign[this.currentSignIndex]][this.config.periods[this.currentPeriodIndex]] = "An unexpected error occurred while fetching the horoscope. Please check the logs.";
            this.updateDom();
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
                    var verticalDuration = (scrollDistance / self.config.scrollSpeed) * 1000;

                    setTimeout(() => {
                        textContent.style.transition = `transform ${verticalDuration}ms linear`;
                        textContent.style.transform = `translateY(-${scrollDistance}px)`;

                        setTimeout(() => {
                            textContent.style.transition = `opacity 0.5s ease-out`;
                            textContent.style.opacity = 0;

                            setTimeout(() => {
                                textContent.style.transition = 'none';
                                textContent.style.transform = 'translateY(0)';
                                
                                void textContent.offsetWidth;

                                textContent.style.transition = `opacity 0.5s ease-in`;
                                textContent.style.opacity = 1;

                                self.isScrolling = false;

                                setTimeout(() => {
                                    self.startScrolling();
                                }, 500);
                            }, 500);
                        }, verticalDuration + self.config.pauseDuration);
                    }, self.config.pauseDuration);
                } else {
                    self.isScrolling = false;
                }
            }
        }, 1000);
    }
});
