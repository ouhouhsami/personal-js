'use strict';

var _Promise = require('babel-runtime/core-js/promise')['default'];

Object.defineProperty(exports, '__esModule', {
    value: true
});
exports.loadSamples = loadSamples;

var _loadSample = require('./loadSample');

function loadSamples(urls) {
    return _Promise.all(urls.map(function (soundURL) {
        return (0, _loadSample.loadSample)(soundURL);
    }));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImVzNi9TeW5jU2VydmVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OzswQkFBeUIsY0FBYzs7QUFFaEMsU0FBUyxXQUFXLENBQUMsSUFBSSxFQUFDO0FBQzdCLFdBQU8sU0FBUSxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFTLFFBQVEsRUFBQztBQUFDLGVBQU8sNEJBQVcsUUFBUSxDQUFDLENBQUE7S0FDekUsQ0FBQyxDQUFDLENBQUM7Q0FDUCIsImZpbGUiOiJlczYvU3luY1NlcnZlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7bG9hZFNhbXBsZX0gZnJvbSAnLi9sb2FkU2FtcGxlJztcblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWRTYW1wbGVzKHVybHMpe1xuICAgIHJldHVybiBQcm9taXNlLmFsbCh1cmxzLm1hcChmdW5jdGlvbihzb3VuZFVSTCl7cmV0dXJuIGxvYWRTYW1wbGUoc291bmRVUkwpXG4gICAgfSkpO1xufVxuIl19