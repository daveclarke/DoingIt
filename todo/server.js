// server.js

  // set up ========================
  var Trello = require("node-trello");
  var assert = require('assert');
  var async = require('async');
  var express  = require('express');
  var app      = express();                               // create our app w/ express
  var mongoose = require('mongoose');                     // mongoose for mongodb
  var morgan = require('morgan');             // log requests to the console (express4)
  var bodyParser = require('body-parser');    // pull information from HTML POST (express4)
  var methodOverride = require('method-override'); // simulate DELETE and PUT (express4)

  // configuration =================
  var url = 'mongodb://win10:27017/doingIt';
  var trello;
  mongoose.set('debug', true);

  app.use(express.static(__dirname + '/public'));       // set the static files location 
  app.use(morgan('dev'));                               // log every request to the console
  app.use(bodyParser.urlencoded({'extended':'true'}));  // parse application/x-www-form-urlencoded
  app.use(bodyParser.json());                                     // parse application/json
  app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
  app.use(methodOverride());

  // mongoose configuration ========
    // define schemas
    var Schema = mongoose.Schema;
    var settingSchema = new Schema({
      key: String,
      secret: String,
      token: String
    });
    var boardSchema = new Schema({
      trelloBoardId: String,
      everyDay: [String],
      weekDay: [String],
      monday: [String],
      tuesday: [String],
      wednesday: [String],
      thursday: [String],
      friday: [String],
      saturday: [String],
      sunday: [String]
    });

    // define models
    var Setting = mongoose.model('Setting', settingSchema);
    var Board = mongoose.model('Board', boardSchema);

  // functions ===================
  function isWeekDay(day) {
    return 0 < day && day <= 5;
  }

  function dayOfWeek(dayIndex) {
    return ["sunday", "monday","tuesday","wednesday","thursday","friday","saturday"][dayIndex];
  }

  function getCards(list, callback){
    trello.get("/1/lists/" + list.id + "/cards/open", function(err, cards) {
      assert.equal(null, err);
      console.dir(cards);
      list.cards = cards;
      callback(null, list);
    });
  }

  function getBoard(doc, callback) {
    trello.get("/1/boards/" + doc.trelloBoardId, function(err, board) {
      assert.equal(null, err);
      trello.get("/1/boards/" + doc.trelloBoardId + "/lists", function(err, lists) {
        assert.equal(null, err);
        async.map(lists, getCards, function(err, result){
          board.lists = result;
          callback(null, board);
        });
      });
    });
  }

  function resetBoard(doc, callback) {
    var today = new Date().getDay();
    console.log("today:", today);
    var day = dayOfWeek(today);
    console.log("dayOfWeek:", day);

    trello.get("/1/boards/" + doc.trelloBoardId, function(err, board) {
      assert.equal(null, err);
      trello.get("1/boards/" + doc.trelloBoardId + "/lists?cards=open&card_fields=idList,name", function(err, lists) {
        assert.equal(null, err);
        // find list id of "To Do" list
        var todoListId = lists.filter(function(list) { return list.name === 'To Do'; })[0].id;
        console.log("todoListId:", todoListId);

        // concat all cards
        var cards = [];
        for (var i = 0; i < lists.length; i++) {
          var cards = cards.concat( lists[i].cards);
        }
        
        for (var i = 0; i < doc.everyDay.length; i++) {
          var match = cards.filter(function(c){ return c.name === doc.everyDay[i]; });
          if (match.length) { 
            if (match[0].idList !== todoListId) {
              trello.put("/1/cards/" + match[0].id, {idList: todoListId}, function(data){
                console.log('Moving card:' + JSON.stringify(data));
              });
            }
          } else {
            trello.post("/1/cards", { name: doc.everyDay[i], idList: todoListId }, function(data){
              console.log('Card created:' + JSON.stringify(data));
            });
          }
        }

        if (isWeekDay(today)){
          for (var i = 0; i < doc.weekDay.length; i++) {
            var match = cards.filter(function(c){ return c.name === doc.weekDay[i]; });
            if (match.length) {
              if (match[0].idList !== todoListId) {
                trello.put("/1/cards/" + match[0].id, {idList: todoListId}, function(data){
                  console.log('Moving card:' + JSON.stringify(data));
                });
              }
            } else {
              trello.post("/1/cards", { name: doc.weekDay[i], idList: todoListId }, function(data){
                console.log('Card created:' + JSON.stringify(data));
              });
            }
          }
        }

        for (var i = 0; i < doc[day].length; i++) {
          var match = cards.filter(function(c){ return c.name === doc[day][i]; });
          if (match.length) { 
            if (match[0].idList !== todoListId) {
              trello.put("/1/cards/" + match[0].id, {idList: todoListId}, function(data){
                console.log('Moving card:' + JSON.stringify(data));
              });
            }
          } else {
            trello.post("/1/cards", { name: doc[day][i], idList: todoListId }, function(data){
              console.log('Card created:' + JSON.stringify(data));
            });
          }
        }

        callback(null, board);
      });
    });
  }

  // routes ======================
  app.get('/api/todos', function(req, res) {
    mongoose.connect(url, function(err, db) {
      if (err) res.send(err);
      console.log("Connected correctly to server.");
      Setting.findOne(function(err, setting) {
	trello = new Trello(setting.key, setting.token);
	Board.find(function(err, docs) {
          if (err) res.send(err);
          if (docs != null) {
            async.map(docs, getBoard, function(err, result){
              console.log("result:", result);
              res.json(result);
            });
          }
          mongoose.disconnect();
        });
      });
    });
  });

  app.get('/api/reset', function(req, res) {
    mongoose.connect(url, function(err, db) {
      if (err) res.send(err);
      console.log("Connected to server.");
      Setting.findOne(function(err, setting) {
        trello = new Trello(setting.key, setting.token);
        Board.find(function(err, docs) {
          if (err) res.send(err);
          console.log(docs);
          if (docs != null) {
            async.map(docs, resetBoard, function(err, result){
              //console.log("result:", result);
              
              res.json(result);
            });
          }
          mongoose.disconnect();
        });
      });
    });
  });


  // application -------------------------------------------------------------
  app.get('*', function(req, res) {
    res.sendfile('./public/index.html'); // load the single view file 
  });

  // listen (start app with node server.js) ======================================
  app.listen(8080);
  console.log("App listening on port 8080");

