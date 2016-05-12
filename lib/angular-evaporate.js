/* global angular, Evaporate */
;(function (Evaporate) {
  'use strict';

  angular
    .module('evaporate', [])

    .provider('eva', function () {
      var options;

      this.config = function (_options) {
        options = _options;
      };

      this.$get = [function () {
        return {
          _: new Evaporate(options),
          urlBase: 'http://' + options.bucket + '.s3.amazonaws.com/'
        };
      }];
    })

    .directive('evaporate', ['eva', function (eva) {

      function link (scope, element) {
        function uuid() {
          // lifted from here -> http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
        }

        function foo () {}

        function indexOf (arr, obj) {
          var imax = arr.length;
          for (var i = 0; i < imax; i++) if (angular.equals(arr[i], obj)) return i;
          return -1;
        }

        // allocate eva's data
        if (!scope.data) scope.data = {};

        // apply defaults for input parameters
        var data = scope.data,
            dir = data.dir ? (data.dir + '/') : '',
            timestampSeparator = data.timestampSeparator || '$',
            headersCommon = data.headersCommon || {},
            headersSigned = data.headersSigned || {},
            onFileProgress = (typeof data.onFileProgress === 'function' ? data.onFileProgress : foo),
            onFileComplete = (typeof data.onFileComplete === 'function' ? data.onFileComplete : foo),
            onFileError = (typeof data.onFileError === 'function' ? data.onFileError : foo),
            onFileCancelled = (typeof data.onFileCancelled === 'function' ? data.onFileCancelled : foo);

        // expose some info for parent scope
        data.ready = false;

        // ready..
        if (eva._.supported) {

          // ..steady..
          element.bind('change', function (event) {

            // clear already uploaded files
            data.files = [];

            // process added files
            angular.forEach(event.target.files, function (file) {

              // process file attrs
              var filename = scope.obfuscateName ? uuid() : file.name;
              file.started = Date.now();
              file.path_ = dir + file.started + timestampSeparator + filename;
              file.url = eva.urlBase + file.path_;

              // queue file for upload
              var uploadId = eva._.add({

                // filename, relative to bucket
                name: file.path_,

                // content
                file: file,

                // headers
                contentType: file.type || 'binary/octet-stream',
                notSignedHeadersAtInitiate: headersCommon,
                xAmzHeadersAtInitiate:      headersSigned,

                // event callbacks
                complete: function () {

                  // check file as completed
                  file.completed = true;

                  // execute user's callback
                  onFileComplete(file);

                  // update ui
                  scope.$apply();
                },
                progress: function (progress) {

                  // update progress
                  file.progress = Math.round(progress * 10000) / 100;
                  file.timeLeft = Math.round(
                    (100 - file.progress) / file.progress *
                    (Date.now() - file.started) / 1000
                  );

                  // execute user's callback
                  onFileProgress(file);

                  // update ui
                  scope.$apply();
                },
                error: function (message) {

                  // remove file from the queue
                  var index = indexOf(data.files, file);
                  if (index !== -1) data.files.splice(index, 1);

                  // execute user's callback
                  onFileError(file, message);

                  // update ui
                  scope.$apply();
                },
                cancelled: function() {
                  // check file as cancelled
                  file.cancelled = true;

                  // execute user's callback
                  onFileCancelled(file);
                }
              });

              file.cancel = function() {
                eva._.cancel(uploadId);
              };

              // expose file data to model
              data.files.push(file);
            });

            element.wrap('<form>').closest('form').get(0).reset();
            element.unwrap();

            // update ui
            scope.$apply();
          });

          // ..go!
          data.ready = true;
        }
      }

      return {
        restrict: 'A',
        link: link,
        scope: {
          data: '=evaModel',
          obfuscateName: '=evaObfuscate'
        }
      };
    }]);

})(Evaporate);
