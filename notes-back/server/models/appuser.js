'use strict';
var path = require('path');
var app = require('.../server');
var loopback = require('loopback');

var frontEndUrl = 'http://localhost:4200';
var backEndUrl = 'http://localhost:3000';


module.exports = function(Appuser) {
    Appuser.beforeRemote('findById', function(req, res, next) {
        req.args.filter = {"include": ["superuser"]};
        next();
    });

    Appuser.beforeRemote('create', function( context, user, next){
      context.args.data.role = "owner";
      next();
    });

    Appuser.afterRemote(`create`, function(context, user, next) {
      var verifyLink = backEndUrl + '/api/appusers/confirm?uid=' + user.id + '&redirect=' + frontEndUrl;
      var options = {
        type: 'email',
        to: user.email,
        from: 'guerson9112@gmail.com',
        subject: 'thanks for registering',
        host: 'localhost',
        template: path.resolve(__dirname, '../boot/views/verify.ejs'),
        user: user,
        verifyHref: verifyLink
      };

      user.verify(options, function( err,  response) {
        if ( err ) {
          Appuser.deleteById(user.id);
          return next(err);
        }
        user.superuser.create( {
          "username": user.username
        }, function(err, resp) {
          if( resp ) {
            console.log("superuser created");
            Appuser.findById(resp.rootUserId, function(err, result){
              result.superuserId = resp.id;
              Appuser.upsert( result, function( err , user ){})
            })
          }
        });
        next();
      })
    } )
};
