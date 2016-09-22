Mura.DisplayObject.muracontacts = Mura.UI.extend({
  // objectparams are available under 'this.context.{yourVar}'

  // Mura invokes this method by default
  render: function() {
    //this.container = Mura(this.context.targetEl); // doesn't work yet
    this.container = jQuery(Mura(this.context.targetEl).node); // works
    this.main(); // Delegating to main()
  }

  , main: function() {
    var self = this;

    Mura
      .getCurrentUser()
      .then(function(currentUser) {
        self.setLoggedInUser(currentUser.getAll());

        if ( currentUser.get('isnew') === 1 ) {
          // User not logged in
          self.container
            .html(muracontacts.templates.body({body:muracontacts.templates.loggedout()}));
        } else {
          // User IS logged in
          Mura(window)
            .on('hashchange', function(e) {
              self.handleHash();
            });

          self.container
            .on('click', '.muracontacts-wrapper .btn-delete', function(e) {
              return confirm('Are you sure?')
                ? true
                : e.preventDefault();
            });

          self.container
            .on('submit', '.muracontacts-wrapper form', function(e) {
              e.preventDefault();
              self.handleForm(Mura.formToObject(e.target));
              return false;
            });

          self.handleHash();
        }
      });
  }

  , routeAction: function(mcaction, objform) {
    var self = this
        , mcaction = mcaction === undefined ? 'list' : mcaction
        , objform = objform === undefined ? {} : objform;

    switch(mcaction) {
      case 'edit':
        self.renderEditContact(objform);
        break;
      case 'editphone':
        self.renderEditPhone(objform);
        break;
      case 'savecontact':
        self.handleSaveContact(objform);
        break;
      case 'savephone':
        self.handleSavePhone(objform);
        break;
      case 'delete':
        self.handleDeleteContact(objform);
        break;
      default: // list or anything else that isn't accounted for
        self.renderList();
    }
  }

  , handleForm: function(objform) {
    var mcaction = objform.mcaction === undefined ? 'list' : objform.mcaction;
    this.routeAction(mcaction, objform);
  }

  , handleHash: function() {
    var self = this;

    self.queryParams = Mura.getQueryStringParams(window.location.hash.replace(/^#/, ''));
    self.queryParams.mcaction = self.queryParams.mcaction || 'list';
    self.routeAction(self.queryParams.mcaction);
  }

  , handleSaveContact: function(objform) {
    var self = this;

    Mura
      .getEntity('person')
      .loadBy('personid', objform.personid)
      .then(function(person) {
        var exists = person.get('isnew') === 0 ? true : false;

        if ( !exists ) {
          objform.userid = self.getLoggedInUser().userid;
        }

        person
          .set(objform)
          .save()
          .then(
            function(obj) {
              // success
              var text = exists ? 'Updated!' : 'Added!';
              self.setMessage({text:text, type:'success'});
              self.renderEditContact(objform);
            },
            function(obj) {
              // fail
              var errormessage = muracontacts.templates.errormessages({errors:obj.get('errors')});

              self.setMessage({text:errormessage, type:'danger'});
              self.renderEditContact(objform);
            }
          );
      });
  }

  , handleDeleteContact: function(objform) {
    var self = this;

    Mura
      .getEntity('person')
      .loadBy('personid', objform.pid)
      .then(function(person) {
        person
          .delete()
          .then(
            function(obj) {
              // success
              self.setMessage({text:'Deleted!', type:'success'});
              self.renderList();
            },
            function(obj) {
              // fail
              self.setMessage({text:'Error deleting!', type:'danger'});
            }
          );
      });
  }

  , renderList: function() {
    var self = this
        , loggedInUser = self.getLoggedInUser()
        , userid = loggedInUser.userid;

    if ( window.location.hash.replace(/^#/, '') !== 'mcaction=list') {
      window.location.hash = 'mcaction=list';
    }

    Mura
      .getFeed('person')
      .where()
      .prop('userid')
      .isEQ( userid )
      .getQuery()
      .then(function(people) {
          // success
          self.renderBody(muracontacts.templates.contactlisttable({people:people.get('items')})); // try people.getAll().items;
        },function(e) {
          // error
          console.warn('Error getting PERSON feed');
          console.log(e);
        });
  }

  , renderEditContact: function(objform) {
    var self = this
        , body = ''
        , message = ''
        , pid = objform === undefined || !objform.hasOwnProperty('personid') || !Mura.isUUID(objform.personid)
            ? Mura.createUUID()
            : objform.personid;

    self.queryParams = Mura.getQueryStringParams(window.location.hash.replace(/^#/, ''));

    if ( Mura.isEmptyObject(objform) ) {
      pid = self.queryParams.pid !== undefined && Mura.isUUID(self.queryParams.pid) ? self.queryParams.pid : pid;
    }

    // fix URL for new contacts (or anyone messing with the pid in the URL)
    if ( !self.queryParams.hasOwnProperty('pid') || !Mura.isUUID(self.queryParams.pid) ) {
      window.location.hash = 'mcaction=edit&pid=' + pid;
    }

    Mura
      .getBean('person')
      .loadBy('personid', pid)
      .then(
        function(person) {
          // success
          var contact = person.getAll()
              , body = ''
              , message = '';

          contact.exists = contact.isnew === 0;
          contact.personid = contact.exists ? contact.personid : pid;
          contact.label = contact.exists ? 'Update' : 'Add';

          if ( objform.hasOwnProperty('namefirst') ) {
            contact.namefirst = objform.namefirst;
          }

          if ( objform.hasOwnProperty('namelast') ) {
            contact.namelast = objform.namelast;
          }

          Mura
            .getFeed('personphonenumber')
            .where()
            .prop('personid')
            .isEQ( contact.personid )
            .getQuery()
            .then(function(phonenumbers) {
                // success
                body = muracontacts.templates.editcontact({contact:contact, phonenumbers:phonenumbers.get('items')});
                self.renderBody(body, message);
              },function(e) {
                // error
                console.warn('Error getting PHONENUMBERS feed');
                console.log(e);
              });

        },
        function(e) {
          // fail
          console.warn('Error getting PERSON bean');
          console.log(e);
        }
      );
  }

  , renderEditPhone: function() {
    var self = this
        , body = '';

    self.renderBody(muracontacts.templates.editphone({body:body}));
  }

  , renderBody: function(body) {
    var self = this
        , body = body === undefined ? '' : body
        , message = self.getMessage()
        , hasmessage = Object.keys(message).length !== 0
        , loggedInUser = self.getLoggedInUser();

    Mura
      .loader()
      .loadcss(self.getDisplayObjectPath() + '/assets/css/muracontacts.min.css');

    // Wraps body with muracontacts-wrapper div
    self.container
      .html(muracontacts.templates.body({
        body: body
        , hasmessage: hasmessage
        , message: message
        , userfirstname: loggedInUser.fname
      }));

    if ( hasmessage ) {
      setTimeout(function() {
        $('.muracontacts-alert').fadeOut('slow');
        self.setMessage();
      }, 2000);
    }
  }

  , setLoggedInUser: function(loggedInUser) {
    this.loggedInUser = loggedInUser;
  }

  , getLoggedInUser: function() {
    return this.loggedInUser;
  }

  , setMessage: function(message) {
    this.message = message;
  }

  , getMessage: function() {
    return this.message === undefined ? {} : this.message;
  }

  , getDisplayObjectPath: function() {
    // Would need to modify if dropping into a plugin
    return Mura.themepath + '/display_objects/muracontacts';
  }

  // Mura automatically triggers this method for us
  ,registerHelpers: function() {
    var self = this;

    // Example of how to register a helper
    //Mura.Handlebars.registerHelper('helpername', function(arg1, arg2) {});
  }

});
