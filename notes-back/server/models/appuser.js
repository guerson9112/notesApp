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

    Appuser.afterRemote('login', function(ctx, res, next){
      var filter = {
          "include" : ["superuser"]
      }
      Appuser.findById(ctx.result.userId, filter, function(err, result){
        if(err == null){
          var rJson = result.toJSON();
          res.responseCode = 200;
          if(rJson.emailVerified) {
            res.emailVerified = true;

          } else {
            res.emailVerified = false;
          }

          res.verificationToken = rJson.verificationToken;
          res.superuserId = rJson.superuserId;
          if(typeof(rJson.role) !== "undefined" && rJson.role == 'owner'){
            res.superuser = rJson.superuser;
            res.role = rJson.role;
          }
          next();
        }
      })
    });

    Appuser.beforeRemote('create', function(context, user, next){
      context.args.data.role = "owner";
      next();
    })
    /**
     * For user registration and sending verification email
     */
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


    Appuser.remoteMethod('updateForgetPassword',
      {
        accepts: [{arg: 'user', type: 'object'}],
        returns: {arg: 'resp', type: 'object'},
        http: {path: '/updateForgetPassword', verb: 'post'}
      })

    Appuser.updateForgetPassword = function (user, cb) {
      var uid = user.data.id;
      var token = user.data.token;
      var password = user.data.password;
      Appuser.confirm(uid, token).then(function(response){
        Appuser.findById(uid, function(err, user){
          if(err){
            cb(err, null);
          }
          if(user !== null && user !== undefined) {
            user.password = password;
            user.save(function(err){
              if(err){
                cb(err, null)
              } else {
                cb(null, {message: "Password  Updated Successfully", status : 200})
              }
            })
          } else {
            cb(null, {message: "User not found", status: 404})
          }
        })
      }, function(err){
        cb(err, null);
      })
     }

    function generateVerificationToken(user, callback){
      app.models.User.generateVerificationToken( user, {}, function(err, res){
        if(err)
          return callback(err, null)

        callback(null, res)
      })
    }

    Appuser.on('resetPasswordRequest', function(email, cb) {
      Appuser.findById(email.user.id, function(err, result){
          generateVerificationToken(result, function(error, token) {
                result.verificationToken = token;
                Appuser.upsert(result, function(err, user) {
                  var encrypt_token = '' + user.verificationToken + '&uid=' + user.id;
                  var verifyHref = 'http://localhost:4200/resetPassword' + '?token=' + encrypt_token;
                  var redirectLink = 'http://localhost:4200/resetPassword';
                  var message = {
                    username: email.username,
                    verifyHref: verifyHref
                  }

                  var renderer = loopback.template(path.resolve(__dirname, '../boot/views/forgetPassword.ejs'));
                  var html = renderer(message);
                  if(email.user) {
                    var options = {
                      type: 'email',
                      to: email.email,
                      from: 'guerson9112@gmail.com',
                      subject: 'Reset Password Request',
                      redirect: redirectLink,
                      html: html
                    }/* -- */

                    Appuser.app.models.Email.send(options, function(err, response) {
                      if(err) {
                        return err;
                      } /* -- */
                    }); /* -- */
                  } /* -- */
                })/* -- */
             })/* -- */
          }) /* -- */
      });

};
