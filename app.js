const restify = require('restify');
const builder = require('botbuilder');
const botbuilder_azure = require("botbuilder-azure");



// Setup Restify Server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
  console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
const connector = new builder.ChatConnector({
  appId: process.env.MicrosoftAppId,
  appPassword: process.env.MicrosoftAppPassword,
  openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users
server.post('/api/messages', connector.listen());

const tableName = 'botdata';
const azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
const tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

const inMemoryStorage = new builder.MemoryBotStorage();

// This is a dinner reservation bot that uses a waterfall technique to prompt users for input.
const bot = new builder.UniversalBot(connector, [
  function (session) {
    session.send("Здравствуйте! Приветствуем вас в чате МТС помощника!");
    session.beginDialog('chooseProblemOrFeedback');
  },
  function (session, results) {
    session.dialogData.reservationDate = builder.EntityRecognizer.resolveTime([results.response]);
    session.beginDialog('askForPartySize');
  },
  function (session, results) {
    session.dialogData.partySize = results.response;
    session.beginDialog('askForReserverName');
  },
  function (session, results) {
    session.dialogData.reservationName = results.response;

    // Process request and display reservation details
    session.send(`Reservation confirmed. Reservation details: <br/>Date/Time: ${session.dialogData.reservationDate} <br/>Party size: ${session.dialogData.partySize} <br/>Reservation name: ${session.dialogData.reservationName}`);
    session.endDialog();
  }
])//.set('storage', tableStorage);
  .set('storage', inMemoryStorage); // Register in-memory storage


// Choose problem or feedback
bot.dialog('chooseProblemOrFeedback', [
  function (session) {
    builder.Prompts.choice(session, "Желаете ли вы...", ["оставить отзыв","обратиться в поддержку"], { listStyle: builder.ListStyle.button });
  },
  function (session, results) {
    session.endDialogWithResult(results);
  }
]);


// Dialog to ask for a date and time
bot.dialog('askForDateTime', [
  function (session) {
    builder.Prompts.time(session, "Please provide a reservation date and time (e.g.: June 6th at 5pm)");
  },
  function (session, results) {
    session.endDialogWithResult(results);
  }
]);

// Dialog to ask for number of people in the party
bot.dialog('askForPartySize', [
  function (session) {
    builder.Prompts.text(session, "How many people are in your party?");
  },
  function (session, results) {
    session.endDialogWithResult(results);
  }
])
  .beginDialogAction('partySizeHelpAction', 'partySizeHelp', { matches: /^help$/i });

// Context Help dialog for party size
bot.dialog('partySizeHelp', function(session, args, next) {
  var msg = "Party size help: Our restaurant can support party sizes up to 150 members.";
  session.endDialog(msg);
})

// Dialog to ask for the reservation name.
bot.dialog('askForReserverName', [
  function (session) {
    builder.Prompts.text(session, "Who's name will this reservation be under?");
  },
  function (session, results) {
    session.endDialogWithResult(results);
  }
]);

// The dialog stack is cleared and this dialog is invoked when the user enters 'help'.
bot.dialog('help', function (session, args, next) {
  session.endDialog("This is a bot that can help you make a dinner reservation. <br/>Please say 'next' to continue");
})
  .triggerAction({
    matches: /^help$/i,
    onSelectAction: (session, args, next) => {
      // Add the help dialog to the dialog stack
      // (override the default behavior of replacing the stack)
      session.beginDialog(args.action, args);
    }
  });