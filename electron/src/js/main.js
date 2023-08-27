let hls = new Hls();

$(function () {
  loadHarFromBox();
  registerActions();
  handleErrors();
});

function registerActions() {
  $("#more").on("click", (e) => {
    if ($("#moreIcon").hasClass("fa-arrow-circle-down")) {
      $("#moreIcon").removeClass("fa-arrow-circle-down");
      $("#moreIcon").addClass("fa-arrow-circle-up");
      $("#moreContents").css("display", "block");
    } else {
      $("#moreIcon").addClass("fa-arrow-circle-down");
      $("#moreIcon").removeClass("fa-arrow-circle-up");
      $("#moreContents").css("display", "none");
    }
  });

  $("#token").on("paste", (_) => {
    setTimeout(loadHarFromBox, 0);
  });
  $("#inputDatabaseName").keyup(loadHarFromBox);

  $("#darkMode").on("click", (e) => {
    $("#wrapper").toggleClass("dark-mode");
  });

  $("#jumpToNow").click((_) => {
    hls.startLoad((startPosition = -1));
  });
}

function handleErrors() {
  if (hls) {
    hls.on(Hls.Events.ERROR, function (event, data) {
      var errorType = data.type;
      var errorDetails = data.details;
      var errorFatal = data.fatal;

      console.log(errorType, errorDetails, errorFatal);

      switch (data.details) {
        case hls.ErrorDetails.FRAG_LOAD_ERROR:
          // ....
          break;
        default:
          break;
      }
    });
  }
}

function loadHarFromBox() {
  let token = $("#token").val();
  if (token) {
    try {
      let harString = Buffer.from(token, "base64");
      let har = JSON.parse(harString);
      let request = har.request;
      let streamUrl = request.url;
      let cookies = request.cookies;
      let headers = request.headers;
      loadVideo(streamUrl, cookies, headers);
    } catch (e) {
      console.error(e);
    }
  }
}

function loadVideo(url, cookies, headers) {
  if (Hls.isSupported()) {
    const video = document.getElementById("video");

    const config = createConfig(cookies, headers);

    hls = new Hls(config);
    // bind them together
    hls.attachMedia(video);
    hls.on(Hls.Events.MEDIA_ATTACHED, function () {
      console.log("video and hls.js are now bound together !");
      hls.loadSource(url);
      hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
        console.log(
          "manifest loaded, found " + data.levels.length + " quality level"
        );
        video.play();
      });
    });
  }
}

function createConfig(cookies, headers) {
  return {
    debug: logger,
    autoStartLoad: true,
    maxBufferLength: 60 * 60 * 12, // max buffer time in seconds, keep it at 12 hours
    xhrSetup: function (xhr, url) {
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 1) {
          console.log("true one ->", xhr, "\n\n");
          let xhrDuped = new XMLHttpRequest(xhr);
          xhrDuped.response = xhr.response;
          xhrDuped.responseText = xhr.ResponseText;
          xhrDuped.responseType = xhr.responseType;
          xhrDuped.responseURL = xhr.responseURL;
          xhrDuped.responseXML = xhr.responseXML;
          xhrDuped.status = xhr.status;
          xhrDuped.timeout = xhr.timeout;
          xhr.withCredentials = true;
          xhrDuped.open("GET", url, true);
          // xhrDuped.readyState = 1;
          console.log("duped one ->", xhr, "\n\n");
          for (let i = 0; i < Object.keys(headers).length; i++) {
            if (
              Object.keys(headers)[i] &&
              !Object.keys(headers)[i].startsWith(":")
            ) {
              if (headersToSet[Object.keys(headers)[i]]) {
                console.log(
                  "set",
                  Object.keys(headers)[i],
                  ":",
                  headers[Object.keys(headers)[i]],
                  "\n"
                );
                xhrDuped.setRequestHeader(
                  Object.keys(headers)[i],
                  headers[Object.keys(headers)[i]]
                );
              }
            }
            xhr = xhrDuped;
          }
        }
        console.log("flase one ->", xhr, "\n\n");
      };
    },
    // loader: customLoader,
  };
}

let headersToSet = {
  host: true,
  referer: true,
  origin: true,
  accept: true,
  // "accept-language": true,
  // "accept-encoding": true,
  "sec-fetch-dest": true,
  "sec-fetch-mode": true,
  "sec-fetch-site": true,
  // "upgrade-insecure-requests": true,
};
