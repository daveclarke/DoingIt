  // public/core.js
  var doingItApp = angular.module('doingItApp', []);

  function mainController($scope, $http) {
	$scope.formData = {};

	// get boards/lists/cards
	$http.get('/api/todos')
	.success(function(data) {
	  $scope.todos = data;
	  console.log(data);
	})
	.error(function(data) {
	  console.log('Error: ' + data);
	});
  }

