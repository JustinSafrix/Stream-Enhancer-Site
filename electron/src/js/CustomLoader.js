/**
 * XHR based logger
 */

const { performance } = window;
const XMLHttpRequest = require("xhr2-unsafe");

var customLoader = function (config) {
  /**
     * Calling load() will start retrieving content located at given URL (HTTP GET).
     *
     * @param {object} context - loader context
     * @param {string} context.url - target URL
     * @param {string} context.responseType - loader response type (arraybuffer or default response type for playlist)
     * @param {number} [context.rangeStart] - start byte range offset
     * @param {number} [context.rangeEnd] - end byte range offset
     * @param {Boolean} [context.progressData] - true if onProgress should report partial chunk of loaded content
     * @param {object} config - loader config params
     * @param {number} config.maxRetry - Max number of load retries
     * @param {number} config.timeout - Timeout after which `onTimeOut` callback will be triggered (if loading is still not finished after that delay)
     * @param {number} config.retryDelay - Delay between an I/O error and following connection retry (ms). This to avoid spamming the server
     * @param {number} config.maxRetryDelay - max connection retry delay (ms)
     * @param {object} callbacks - loader callbacks
     * @param {onSuccessCallback} callbacks.onSuccess - Callback triggered upon successful loading of URL.
     * @param {onProgressCallback} callbacks.onProgress - Callback triggered while loading is in progress.
     * @param {onErrorCallback} callbacks.onError - Callback triggered if any I/O error is met while loading fragment.
     * @param {onTimeoutCallback} callbacks.onTimeout - Callback triggered if loading is still not finished after a certain duration.

      @callback onSuccessCallback
      @param response {object} - response data
      @param response.url {string} - response URL (which might have been redirected)
      @param response.data {string/arraybuffer/sharedarraybuffer} - response data (reponse type should be as per context.responseType)
      @param stats {LoadStats} - loading stats
      @param stats.aborted {boolean} - must be set to true once the request has been aborted
      @param stats.loaded {number} - nb of loaded bytes
      @param stats.total {number} - total nb of bytes
      @param stats.retry {number} - number of retries performed
      @param stats.chunkCount {number} - number of chunk progress events
      @param stats.bwEstimate {number} - download bandwidth in bits/s
      @param stats.loading { start: 0, first: 0, end: 0 }
      @param stats.parsing { start: 0, end: 0 }
      @param stats.buffering { start: 0, first: 0, end: 0 }
      @param context {object} - loader context
      @param networkDetails {object} - loader network details (the xhr for default loaders)

      @callback onProgressCallback
      @param stats {LoadStats} - loading stats
      @param context {object} - loader context
      @param data {string/arraybuffer/sharedarraybuffer} - onProgress data (should be defined only if context.progressData === true)
      @param networkDetails {object} - loader network details (the xhr for default loaders)

      @callback onErrorCallback
      @param error {object} - error data
      @param error.code {number} - error status code
      @param error.text {string} - error description
      @param context {object} - loader context
      @param networkDetails {object} - loader network details (the xhr for default loaders)

      @callback onTimeoutCallback
      @param stats {LoadStats} - loading stats
      @param context {object} - loader context

   */

  if (config && config.xhrSetup) {
    this.xhrSetup = config.xhrSetup;
  }

  this.load = function (context, config, callbacks) {
    this.context = context;
    this.config = config;
    this.callbacks = callbacks;
    this.stats = {
      trequest: performance.now(),
      retry: 0,
    };
    this.retryDelay = config.retryDelay;
    this.loadInternal();
  };

  /** Abort any loading in progress. */
  this.abort = function () {
    console.log("abort");
    let loader = this.loader;
    if (loader && loader.readyState !== 4) {
      this.stats.aborted = true;
      loader.abort();
    }

    window.clearTimeout(this.requestTimeout);
    this.requestTimeout = null;
    window.clearTimeout(this.retryTimeout);
    this.retryTimeout = null;
  };

  /** Destroy loading context. */
  this.destroy = function () {
    this.abort();
    this.loader = null;
  };

  this.arrayBufferToString8 = function (buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  };

  this.loadInternal = function () {
    let xhr,
      context = this.context;
    xhr = this.loader = new XMLHttpRequest();

    let stats = this.stats;
    stats.tfirst = 0;
    stats.loaded = 0;
    const xhrSetup = this.xhrSetup;

    try {
      if (xhrSetup) {
        try {
          xhrSetup(xhr, context.url);
        } catch (e) {
          // fix xhrSetup: (xhr, url) => {xhr.setRequestHeader("Content-Language", "test");}
          // not working, as xhr.setRequestHeader expects xhr.readyState === OPEN
          xhr.open("GET", context.url, true);
          xhrSetup(xhr, context.url);
        }
      }
      if (!xhr.readyState) {
        xhr.open("GET", context.url, true);
      }
    } catch (e) {
      console.log("ERROR", e);
      // IE11 throws an exception on xhr.open if attempting to access an HTTP resource over HTTPS
      this.callbacks.onError(
        {
          code: xhr.status,
          text: e.message,
        },
        context,
        xhr
      );
      return;
    }

    if (context.rangeEnd) {
      xhr.setRequestHeader(
        "Range",
        "bytes=" + context.rangeStart + "-" + (context.rangeEnd - 1)
      );
    }

    xhr.onreadystatechange = this.readystatechange.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.responseType = context.responseType;

    // setup timeout before we perform request
    this.requestTimeout = window.setTimeout(
      this.loadtimeout.bind(this),
      this.config.timeout
    );
    xhr.send();
  };

  this.readystatechange = function (event) {
    let xhr = event.currentTarget,
      readyState = xhr.readyState,
      stats = this.stats,
      context = this.context,
      config = this.config;

    // ! ADDED BY ME
    stats.parsing = {};

    // don't proceed if xhr has been aborted
    if (stats.aborted) {
      return;
    }

    // >= HEADERS_RECEIVED
    if (readyState >= 2) {
      // clear xhr timeout and rearm it if readyState less than 4
      window.clearTimeout(this.requestTimeout);
      if (stats.tfirst === 0) {
        stats.tfirst = Math.max(performance.now(), stats.trequest);
      }

      if (readyState === 4) {
        let status = xhr.status;
        // http status between 200 to 299 are all successful
        if (status >= 200 && status < 300) {
          stats.tload = Math.max(stats.tfirst, performance.now());
          let data, len;
          if (context.responseType === "arraybuffer") {
            data = xhr.response;
            len = data.byteLength;
          } else {
            data = xhr.responseText;
            len = data.length;
          }
          stats.loaded = stats.total = len;
          let response = {
            url: xhr.responseURL,
            data: data,
          };
          // ! THE STATS BEING BROKE WAS ISSUE (STATS.PARSING) WASNT THERE
          this.callbacks.onSuccess(response, stats, context, xhr);
        } else {
          // if max nb of retries reached or if http status between 400 and 499 (such error cannot be recovered,
          // retrying is useless), return error
          if (
            stats.retry >= config.maxRetry ||
            (status >= 400 && status < 499)
          ) {
            console.error(`${status} while loading ${context.url}`);
            if (xhr.responseType === "arraybuffer") {
              console.error(this.arrayBufferToString8(xhr.response));
            }
            this.callbacks.onError(
              {
                code: status,
                text: xhr.statusText,
              },
              context,
              xhr
            );
          } else {
            // retry
            console.warn(
              `${status} while loading ${context.url}, retrying in ${this.retryDelay}...`
            );
            // aborts and resets internal state
            this.destroy();
            // schedule retry
            this.retryTimeout = window.setTimeout(
              this.loadInternal.bind(this),
              this.retryDelay
            );
            // set exponential backoff
            this.retryDelay = Math.min(
              2 * this.retryDelay,
              config.maxRetryDelay
            );
            stats.retry++;
          }
        }
      } else {
        // readyState >= 2 AND readyState !==4 (readyState = HEADERS_RECEIVED || LOADING) rearm timeout as xhr not
        // finished yet
        this.requestTimeout = window.setTimeout(
          this.loadtimeout.bind(this),
          config.timeout
        );
      }
    }
  };

  this.loadtimeout = function () {
    console.warn(`timeout while loading ${this.context.url}`);
    this.callbacks.onTimeout(this.stats, this.context, null);
  };

  this.loadprogress = function (event) {
    let xhr = event.currentTarget,
      stats = this.stats;

    stats.loaded = event.loaded;
    if (event.lengthComputable) {
      stats.total = event.total;
    }

    let onProgress = this.callbacks.onProgress;
    if (onProgress) {
      // third arg is to provide on progress data
      onProgress(stats, this.context, null, xhr);
    }
  };
};

class CustomLoader {
  constructor(config) {
    if (config && config.xhrSetup) {
      this.xhrSetup = config.xhrSetup;
    }
  }

  destroy() {
    this.abort();
    this.loader = null;
  }

  abort() {
    let loader = this.loader;
    if (loader && loader.readyState !== 4) {
      this.stats.aborted = true;
      loader.abort();
    }

    window.clearTimeout(this.requestTimeout);
    this.requestTimeout = null;
    window.clearTimeout(this.retryTimeout);
    this.retryTimeout = null;
  }

  load(context, config, callbacks) {
    this.context = context;
    this.config = config;
    this.callbacks = callbacks;
    this.stats = {
      trequest: performance.now(),
      retry: 0,
    };
    this.retryDelay = config.retryDelay;
    this.loadInternal();
  }

  arrayBufferToString8(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  }

  loadInternal() {
    console.log("loading internal");
    let xhr,
      context = this.context;
    xhr = this.loader = new XMLHttpRequest();

    let stats = this.stats;
    stats.tfirst = 0;
    stats.loaded = 0;
    const xhrSetup = this.xhrSetup;

    try {
      if (xhrSetup) {
        console.log("xhr setup found");
        try {
          console.log("try xhr");
          xhrSetup(xhr, context.url);
          console.log("xhr good");
        } catch (e) {
          // fix xhrSetup: (xhr, url) => {xhr.setRequestHeader("Content-Language", "test");}
          // not working, as xhr.setRequestHeader expects xhr.readyState === OPEN
          xhr.open("GET", context.url, true);
          xhrSetup(xhr, context.url);
        }
      }
      if (!xhr.readyState) {
        xhr.open("GET", context.url, true);
      }
    } catch (e) {
      // IE11 throws an exception on xhr.open if attempting to access an HTTP resource over HTTPS
      this.callbacks.onError(
        {
          code: xhr.status,
          text: e.message,
        },
        context,
        xhr
      );
      return;
    }

    if (context.rangeEnd) {
      xhr.setRequestHeader(
        "Range",
        "bytes=" + context.rangeStart + "-" + (context.rangeEnd - 1)
      );
    }

    xhr.onreadystatechange = this.readystatechange.bind(this);
    xhr.onprogress = this.loadprogress.bind(this);
    xhr.responseType = context.responseType;

    // setup timeout before we perform request
    this.requestTimeout = window.setTimeout(
      this.loadtimeout.bind(this),
      this.config.timeout
    );
    xhr.send();
  }

  readystatechange(event) {
    let xhr = event.currentTarget,
      readyState = xhr.readyState,
      stats = this.stats,
      context = this.context,
      config = this.config;

    // ! ADDED BY ME
    // stats.parsing = {};

    // don't proceed if xhr has been aborted
    if (stats.aborted) {
      return;
    }

    // >= HEADERS_RECEIVED
    if (readyState >= 2) {
      // clear xhr timeout and rearm it if readyState less than 4
      window.clearTimeout(this.requestTimeout);
      if (stats.tfirst === 0) {
        stats.tfirst = Math.max(performance.now(), stats.trequest);
      }

      if (readyState === 4) {
        let status = xhr.status;
        // http status between 200 to 299 are all successful
        if (status >= 200 && status < 300) {
          stats.tload = Math.max(stats.tfirst, performance.now());
          let data, len;
          if (context.responseType === "arraybuffer") {
            data = xhr.response;
            len = data.byteLength;
          } else {
            data = xhr.responseText;
            len = data.length;
          }
          stats.loaded = stats.total = len;
          let response = {
            url: xhr.responseURL,
            data: data,
          };
          // ! THE STATS BEING BROKE WAS ISSUE (STATS.PARSING) WASNT THERE
          this.callbacks.onSuccess(response, stats, context, xhr);
        } else {
          // if max nb of retries reached or if http status between 400 and 499 (such error cannot be recovered,
          // retrying is useless), return error
          if (
            stats.retry >= config.maxRetry ||
            (status >= 400 && status < 499)
          ) {
            console.error(`${status} while loading ${context.url}`);
            if (xhr.responseType === "arraybuffer") {
              console.error(this.arrayBufferToString8(xhr.response));
            }
            this.callbacks.onError(
              {
                code: status,
                text: xhr.statusText,
              },
              context,
              xhr
            );
          } else {
            // retry
            console.warn(
              `${status} while loading ${context.url}, retrying in ${this.retryDelay}...`
            );
            // aborts and resets internal state
            this.destroy();
            // schedule retry
            this.retryTimeout = window.setTimeout(
              this.loadInternal.bind(this),
              this.retryDelay
            );
            // set exponential backoff
            this.retryDelay = Math.min(
              2 * this.retryDelay,
              config.maxRetryDelay
            );
            stats.retry++;
          }
        }
      } else {
        // readyState >= 2 AND readyState !==4 (readyState = HEADERS_RECEIVED || LOADING) rearm timeout as xhr not
        // finished yet
        this.requestTimeout = window.setTimeout(
          this.loadtimeout.bind(this),
          config.timeout
        );
      }
    }
  }

  loadtimeout() {
    console.warn(`timeout while loading ${this.context.url}`);
    this.callbacks.onTimeout(this.stats, this.context, null);
  }

  loadprogress(event) {
    let xhr = event.currentTarget,
      stats = this.stats;

    stats.loaded = event.loaded;
    if (event.lengthComputable) {
      stats.total = event.total;
    }

    let onProgress = this.callbacks.onProgress;
    if (onProgress) {
      // third arg is to provide on progress data
      onProgress(stats, this.context, null, xhr);
    }
  }
}
