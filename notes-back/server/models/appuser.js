'use strict';
var path = require('path');
var app = require('../server');
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

    Appuser.beforeRemote('confirm', function(ctx, res, next) {
      var redirectLink = "localhost:4200";
      Appuser.findById(ctx.args.uid, function(err, result){
        if(result.emailVerified) {
          ctx.res.send(
            '<div align="center">'+
            '<div style="background-color: #fff; border-radius: 8px; width: 570px; heigth: 250px">'+
            '<h1> You have already verified your email></h1>'+
            '<a href="http://'+redirectLink+' ">Confirm</a>'+
            '</div></div>'
          );
        } else {
          next();
        }
      })
    } )

    Appuser.afterRemote('confirm', function(ctx, res, next) {
      ctx.args.status = 'enabled';
      Appuser.findById(ctx.args.uid,  function(err, result) {
        result.status = 'enabled';
        Appuser.upsert(result, function(err, user){
          next();
        })
      })
    } )

    Appuser.remoteMethod('sendEmail',
      {
        accepts: [{arg: 'email', type: 'string'}],
        returns: {arg: 'email', type: 'string'},
        http: {path: '/sendEmail', verb: 'post'}
      });

    Appuser.sendEmail = function(email, cb){
      Appuser.find({"where": {"email": email}}, function(err, user){
          if (user[0].verificationToken){



          var verifyLink = backEndUrl + '/api/appusers/confirm?uid=' + user[0].id + '&redirect=' + frontEndUrl;
          var options = {
            type: 'email',
            to: user[0].email,
            from: 'guerson9112@gmail.com',
            subject: 'thanks for registering',
            host: 'localhost',
            template: path.resolve(__dirname, '../boot/views/verify.ejs'),
            user: user[0],
            verifyHref: verifyLink
          };

          user[0].verify(options, function(err, response){
            if(err){
                Appuser.deleteById(user[0].id);
            }
            cb(null, response);
          })
        }
    })
    }
};
