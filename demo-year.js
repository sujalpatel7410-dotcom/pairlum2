/* ==========================================================================
   PAIRLUM — "one year of heavy use" demo
   Loaded only when the address has ?demo=year (app.html decides). It shows
   the same app, with the same code, holding what a couple who use Pairlum
   every day would have after a full year.

   · Nothing here touches the real space on this device: while the demo is
     on, the app keeps its data, its tab-to-tab messages and its media under
     the "demoyear:" name (window.PAIRLUM_STORAGE_NS).
   · It starts fresh each day, so changes made inside the demo last a day.
   · The pictures are painted stand-ins in /demo (no people, no network).
   · The voice notes are hummed stand-ins, so playback is real sound, not a pretend bar.
   · Each voice has a SAMPLE write-up (title, feeling, topics, words), marked as a sample in the app,
     so "Find a voice" can be tried. The words are examples; they are not what the hum says.
   · Everything is dated from today, so it always reads as "the last year".
   · Leave with ?demo=off (the link in Us → the preview box does this).
   ========================================================================== */
(function(){
  "use strict";

  /* ---------- 1. keep the demo apart from the real space ---------- */
  // The app stores everything under one prefix (see NS in app.js). The demo
  // names its own, so its data, the messages between its two tabs and its
  // media database are all separate from a real space on this device.
  var PREFIX = "demoyear:";
  window.PAIRLUM_STORAGE_NS = PREFIX;
  var store = window.localStorage;
  var ls = {
    getItem: function(k){ return store.getItem(PREFIX + k); },
    setItem: function(k, v){ store.setItem(PREFIX + k, v); }
  };

  var A = "u_aarav", B = "u_mira";
  var DAY = 86400000, NOW = Date.now();
  // the couple's shared calendar is India time, the same one app.js counts days on
  var DK0 = Math.floor((NOW + 330 * 60000) / DAY);
  var IMG = "demo/";

  /* ---------- 2. small tools ---------- */
  var seed = 20261006;
  function rnd(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function pick(list){ return list[Math.floor(rnd() * list.length)]; }
  function between(a, b){ return a + Math.floor(rnd() * (b - a + 1)); }
  function pad(n){ return n < 10 ? "0" + n : String(n); }
  function iso(d){ return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function midnight(daysAgo){ var d = new Date(NOW); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - daysAgo); return d; }
  function at(daysAgo, hour, min){ var d = midnight(daysAgo); d.setHours(hour, min === undefined ? between(0, 59) : min, between(0, 59), 0); return Math.min(d.getTime(), NOW - 60000); }
  function isoAgo(daysAgo){ return iso(midnight(daysAgo)); }
  function monthOf(daysAgo){ return midnight(daysAgo).getMonth() + 1; }
  var MEDIA = {};                                   // id -> picture, read by app.js
  function pic(id, name){ MEDIA[id] = IMG + name + ".jpg"; }
  function snd(id, name){ MEDIA[id] = IMG + name + ".mp3"; }   // hummed stand-ins, so voice really plays
  var POSTERS = {};                                 // id -> the still shown before a clip plays
  function clip(id, name){ MEDIA[id] = IMG + "clip-" + name + ".mp4"; POSTERS[id] = IMG + name + ".jpg"; }
  var CLIPS = ["ferris", "sea-1", "rain-window-1", "fireworks", "kites", "snow-market"];
  function inSeason(name, month){ return !SEASON[name] || SEASON[name].indexOf(month) > -1; }

  /* ---------- 3. the pictures and what each of them would say ---------- */
  var ALL = ["airport","autumn","beach","bedroom","berlin-night","blossom","book-blanket","canal","candle-dinner","chai","city-dawn","city-night","coffee-two","coffee","desk","diyas","dusk-1","dusk-2","dusk-3","fairy-lights","ferris","fireworks","flowers-1","flowers-2","garden-path","gift","kites","lake","letter","monsoon","moon","mountains-1","mountains-2","movie-night","pancakes","plane-window-1","plane-window-2","polaroids","rain-window-1","rain-window-2","record","road","rooftops","sea-1","sea-2","snow-market","stars","street-rain","suitcase","thali","tickets","train-window","video-call","windowsill"];
  // which months a picture belongs to (none = any time of year)
  var SEASON = { "snow-market":[12,1], "fireworks":[12,1,11], "kites":[1], "blossom":[3,4], "monsoon":[6,7,8,9], "diyas":[10,11], "autumn":[10,11], "garden-path":[4,5,6], "beach":[4,5,6] };
  var CAP = {
    a: {   // Aarav, Ahmedabad
      "coffee":["Morning coffee, same mug as always.","Second cup. Don't tell my mother."],
      "chai":["Cutting chai at the corner stall. Next one's on me.","Chai break. The uncle asked where madam is."],
      "rooftops":["Terrace, 6:40. The sky did the thing again.","Water-tank view. Still the best seat in the city."],
      "kites":["Uttarayan. I saved you a kite and lost three.","The whole sky is paper today."],
      "thali":["Mum's thali. She asked about you twice.","Sunday lunch. Your seat is being kept."],
      "monsoon":["First proper rain. The whole city smells of it.","Got soaked crossing one road. Worth it."],
      "desk":["Late one at the office. Call when you're up?","New flat, first desk. It wobbles."],
      "diyas":["Diwali lights. Wish you were on this floor with me.","Rangoli by my cousin. I held the torch."],
      "road":["Drove out to Thol at sunrise. Thought of you the whole way.","Empty highway, your playlist."],
      "train-window":["Train to Vadodara. Window seat, obviously.","Fields for two hours. It was nice, actually."],
      "dusk-1":["This sky, tonight. Sending it before it goes.","Stopped the scooter for this."],
      "dusk-2":["Pink for exactly four minutes.","Evening walk. You'd have made us stop here."],
      "dusk-3":["Early flight people get this. I get this.","5:50am. Why am I awake. Look though."],
      "moon":["Same moon. I checked.","Moon's loud tonight."],
      "stars":["Power cut. Found the stars.","Drove out far enough to see this."],
      "movie-night":["Pressed play at 9:30 sharp. Your turn.","Popcorn for one, running commentary for two."],
      "record":["Dad's old records. This one is ours now.","Played side A twice."],
      "book-blanket":["Finally reading the book you sent.","Page 112. No spoilers."],
      "video-call":["You froze like this for a full minute.","Three hours. My ear is warm."],
      "letter":["Wrote you something. It's in Letters.","Handwriting practice. Don't laugh."],
      "suitcase":["Packed. Four days early.","One bag. Half of it is snacks for you."],
      "airport":["Gate 12. Boarding in twenty.","Dropped you off. Sat in the car for a while."],
      "plane-window-1":["Somewhere over Turkey. Hi.","Above the clouds, on my way to you."],
      "plane-window-2":["The flight home. I hate this view.","Wing, sky, and a very quiet seat."],
      "tickets":["Booked. It's real now.","Boarding pass. Keeping this one."],
      "bedroom":["Fell asleep on call again. Sorry. Not sorry.","Your side of the screen is still on."],
      "fairy-lights":["Put the lights up like yours.","My room is trying to be your room."],
      "rain-window-1":["Rain on the cab window. City's a blur.","Stuck in traffic. It's pretty, at least."],
      "rain-window-2":["Watching it come down from the office.","Rain again. Thinking of your window."],
      "flowers-1":["The flower market. I didn't buy any. I should have.","For your desk, when I'm there."],
      "flowers-2":["Marigolds everywhere today.","Mum's garden is showing off."],
      "gift":["Your parcel left today. Don't track it.","Wrapped it myself. You can tell."],
      "polaroids":["Printed the Berlin ones. The wall is filling up.","Us, on string."],
      "pancakes":["Tried your pancakes. They were roti-adjacent.","Breakfast for dinner. You started this."],
      "windowsill":["Two cups out of habit.","Morning light in the new flat."],
      "candle-dinner":["Dinner on call. I lit a candle like an idiot.","Our Friday table, two time zones."],
      "coffee-two":["Two cups. Same table. Finally.","Ordered yours before you sat down."],
      "sea-1":["Drove to the coast. It was worth the six hours.","Sunrise at Diu. You'd have complained and loved it."],
      "sea-2":["Last light on the water.","Stayed till it went dark."],
      "mountains-1":["Abu at dawn. Cold. Perfect.","Up before everyone for this."],
      "mountains-2":["Blue hour in the hills.","The air up here is different."],
      "beach":["One umbrella, nobody else.","Sand in everything. No regrets."],
      "city-night":["City from the flyover.","Late drive. Windows down."],
      "garden-path":["Law Garden, early. Before the crowds.","Walked the long way to work."],
      "lake":["Kankaria, Sunday evening.","One boat. I wanted it to be ours."]
    },
    b: {   // Mira, Berlin
      "berlin-night":["Walked home the long way.","The tower's lit. I waved for both of us."],
      "canal":["Lunch by the canal. Too cold. Did it anyway.","Bike's back from the shop."],
      "snow-market":["Christmas market. Bought you the ugly mug.","First snow. I stood in it like a tourist."],
      "windowsill":["Two mugs out of habit.","My plant is still alive. Mostly."],
      "rain-window-1":["Tram window. Everyone's quiet today.","Rain since morning. I don't even mind."],
      "rain-window-2":["It's coming down. Staying in.","Window seat at the café. Yours is empty."],
      "street-rain":["Wet streets, yellow lights, your voice note on repeat.","Missed the last U-Bahn. Walked. Worth it."],
      "blossom":["Spring finally showed up.","The whole street went pink overnight."],
      "autumn":["The park is orange now.","Leaves everywhere. Kicked through all of them."],
      "ferris":["They put the wheel up again.","Didn't go on it. Saving it."],
      "fireworks":["Silvester from my window. Loud.","Midnight here. 4:30 for you. Happy new year twice."],
      "flowers-1":["Bought myself flowers. Pretend they're from you.","Saturday market haul."],
      "flowers-2":["Yellow ones this week.","They lasted nine days. A record."],
      "candle-dinner":["Cooked your dal. It's a 6 out of 10.","Table for one and a laptop."],
      "bedroom":["Can't sleep. Your side of the call is dark.","4am thoughts. All of them you."],
      "fairy-lights":["Lights are back up. It's officially winter.","Made the room soft tonight."],
      "city-dawn":["Couldn't sleep. Watched this instead.","Early shift. The city's not awake either."],
      "lake":["Wannsee on Sunday.","Sat by the water for an hour doing nothing."],
      "garden-path":["Tiergarten shortcut. I got lost on purpose.","Everything's green again."],
      "gift":["It arrived!! Not opening it till we're on call.","Wrapped yours. Badly. With love."],
      "polaroids":["Printed us. The wall is filling up.","New row started."],
      "tickets":["Booked. BER to AMD. I'm shaking.","Seat 23A. Window. For crying privately."],
      "suitcase":["Packing a week early. Don't judge.","Half this bag is things you asked for."],
      "airport":["Dropped you at BER. Hated every minute.","Departures. Again."],
      "plane-window-1":["Somewhere over the sea. On my way.","Clouds and one very impatient passenger."],
      "plane-window-2":["Flying back. Already counting.","I cried at this window. The man next to me pretended not to see."],
      "coffee":["Flat white, extra hot, alone.","The barista asked about you. Again."],
      "coffee-two":["Two cups. Same table. Finally.","You stole the foam off mine."],
      "desk":["New job, new desk, same nerves.","Working late. Send memes."],
      "moon":["Same moon. Confirmed.","Look up. Now."],
      "stars":["Brandenburg, no lights. Look.","Counted eleven and gave up."],
      "dusk-1":["9pm and still light. Summer's here.","Balcony, wine, this."],
      "dusk-2":["The sky outside my office right now.","Stopped on the bridge for this."],
      "dusk-3":["Morning run. Yes, me.","Up before the alarm for once."],
      "movie-night":["Pressed play. 3, 2, 1.","You talked through the whole thing. I love that."],
      "record":["Found this at the flea market. For us.","Sunday, side B."],
      "book-blanket":["Blanket, tea, the book you hated.","Reading your margins."],
      "video-call":["Screenshot. You look ridiculous. Keeping it.","Call number who-knows."],
      "letter":["Wrote to you on actual paper.","It's in Letters. Open it tonight."],
      "pancakes":["Sunday pancakes. Made two plates out of habit.","Your recipe. Better than yours."],
      "sea-1":["Baltic day trip. Freezing. Beautiful.","Ostsee at sunrise."],
      "sea-2":["Last light at the coast.","Waited for it to go down."],
      "mountains-1":["Work trip. Alps out the window.","Hiked up. Thought about you at the top."],
      "mountains-2":["Blue mountains. Blue mood. Fine now.","Cold and quiet up here."],
      "beach":["One day of actual summer.","Found the only umbrella."],
      "city-night":["City from the S-Bahn.","Late. Lights. Home soon."],
      "train-window":["Train to Hamburg. Thinking.","Fields. Then more fields."],
      "thali":["Found a Gujarati place. It's not your mum's.","I ordered everything."],
      "chai":["Made chai your way. Burned my tongue.","Masala from your parcel. Finally right."],
      "diyas":["Lit some for Diwali. Alone, but lit.","Your mum sent these."],
      "rooftops":["From your terrace. I get it now.","Your city, your sky."],
      "kites":["My first Uttarayan. I'm terrible at this.","Kites!!"],
      "monsoon":["So THIS is the rain you talk about.","Soaked in four seconds. I love it."],
      "road":["Out of the city for a day.","Rented a car. Drove nowhere in particular."]
    }
  };
  var TOGETHER = [   // the days they were in the same city
    ["coffee-two","Two cups. Same table. Finally."],["candle-dinner","Dinner. One time zone."],["ferris","We went on it. You screamed."],
    ["lake","Sat by the water. Didn't check the time once."],["movie-night","Same sofa. You still talked through it."],["pancakes","Breakfast, made badly, together."],
    ["polaroids","Printed these the same afternoon."],["bedroom","No call tonight. Don't need one."],["fairy-lights","Your room, in person."],
    ["thali","At the table, both of us. Mum cried."],["rooftops","The terrace, with you on it."],["chai","Two glasses this time."],
    ["berlin-night","Walking home. Both of us."],["canal","You on my bike. Wobbling."],["flowers-1","You actually brought flowers."],
    ["dusk-2","Same sky, same spot, for once."],["record","Danced in the kitchen. No one saw."],["book-blanket","Slow Sunday. Shared blanket."],
    ["windowsill","Both mugs in use."],["garden-path","Walked nowhere, slowly."]
  ];
  var WORDS = {
    a: ["train was late again but I got a seat by the window","mum asked when you're coming. I said soon. I meant it","just walked past the place with the bad samosas. missed you specifically","power's out. sitting in the dark thinking about your kitchen","presentation done. I didn't die","the auto driver was playing our song. I tipped him too much","it's 44 degrees. I am a puddle","found your hair tie in my bag. keeping it","new flat keys!! you get the second set","ate dinner at 11pm so we could eat together. worth it","the neighbours' dog now waits for me. you have competition","can't focus. keep rereading your letter","signal's bad on the highway. I love you, in case it drops","learned to make your pasta. called it Mira's. everyone asked who Mira is","6 hours of sleep and I'd still pick the call","the chaiwala knows your order now","said your name in a meeting by accident","today was long. you were the good part","I counted. 200 days of doing this. I'd do 200 more","no reason. just wanted you to know I'm thinking about you"],
    b: ["told the barista about you. she wants to meet you now too","it's dark at 4pm and I refuse to accept it","my boss said my name wrong again. I answered anyway","bought two tickets to something out of habit","the U-Bahn smelled like your shampoo. I nearly cried","first day done. I think they like me","I made your dal and the smoke alarm went off","walked 9km because I didn't want to go home to a quiet flat","your voice note got me through the whole commute","it snowed. I wrote your name on a car","found the photo booth strip in my coat pocket","my mum asked if you're eating properly","the plant has a new leaf. I'm telling everyone","I keep starting sentences with 'Aarav says'","cancelled plans to stay in and call you. no regrets","today I missed you in the cereal aisle. no idea why","got the contract!!! call me the second you wake up","sent you a parcel. it has four things and a secret","one year of this app and I still check it first","nothing happened today. I wanted to tell you anyway"]
  };
  var NOTE_POOL = {
    a: ["hope your meeting went okay","the cafe played our song again","miss stealing your fries, not even sorry","saw a girl with your coat. did a double take","drink water. I know you haven't","thinking about your laugh for no reason","good luck today. you've got it","you'd love the sky right now","eat something that isn't toast","proud of you. that's the note","still thinking about last night's call","it's raining and I thought of your window","20 minutes till I can call you","you're my favourite notification","sleep well when you get there","heard a joke. saving it for tonight","wore the shirt you like","the moon's out. go look","I'm outside your time zone but not your corner","just you. that's all","counting down, obviously","rough day? I'm here","your tea is getting cold, I can feel it","made it home. thinking of you","this song is very you","I love you. carry on","23 days","don't forget your umbrella","I'm so glad it's you","thought of you at the red light"],
    b: ["saw this and thought of you","this song is very you","found your handwriting in my old notebook","walked past our bench","you'd hate this weather. I love it","good morning from four and a half hours behind","did you eat? properly?","proud of you today","the tram driver waved. small joys. you","thinking of you between meetings","your hoodie still smells right","come home soon. or I will","I laughed out loud on the train. your fault","sending a hug with bad wifi","miss your terrible singing","you awake? no reason","can't wait for Friday's call","made too much food again","it's your face I want to see","look at the moon when you can","mine. just saying","text me when you land","one more sleep till the weekend","I like us","was thinking about the airport hug","breathe. you've got this","you're doing better than you think","tell your mum hi","23 days. I'm counting louder than you","goodnight from tomorrow"]
  };

  /* ---------- 4. build the shared space ---------- */
  function build(){
    var db = { v: 1 };
    var REUNION_IN = 23;                               // days until the next reunion
    var V1 = [300, 291], V2 = [88, 80];                // the two visits in the past year (days ago)
    function together(n){ return (n <= V1[0] && n >= V1[1]) || (n <= V2[0] && n >= V2[1]); }
    function inAhmedabad(n){ return n <= V2[0] && n >= V2[1]; }

    /* --- today on Shared Day (shown the way the app shows a day) --- */
    db.moments = [
      { id:"dyt1", by:A, demo:true, type:"photo", photo:"dy-dusk-3", size:"hero", caption:"Terrace before work. Chai, and the sky doing the thing again.", time:"6:40 AM · Ahmedabad" },
      { id:"dyt2", by:B, demo:true, type:"photo", photo:"dy-windowsill", size:"side", caption:"Two mugs out. One is yours in " + REUNION_IN + " days.", time:"9:05 AM · Berlin" },
      { id:"dyt3", by:A, demo:true, type:"photo", photo:"dy-desk", size:"side", caption:"Demo day. Wish me luck.", time:"11:40 AM · Ahmedabad" },
      { id:"dyt4", by:B, demo:true, type:"photo", photo:"dy-autumn", size:"side", caption:"Lunch walk. The park went orange without telling me.", time:"1:15 PM · Berlin" },
      { id:"dyt5", by:A, demo:true, type:"text", text:"Demo went fine!! They clapped. I blacked out for the middle part.", time:"2:02 PM · Ahmedabad", size:"text" },
      { id:"dyt6", by:B, demo:true, type:"text", text:"TOLD YOU. Dinner's on me in " + REUNION_IN + " days. Anything you want.", time:"10:36 AM · Berlin", size:"text" },
      { id:"dyt7", by:B, demo:true, type:"voice", caption:"Voice note", time:"11:20 AM · Berlin", size:"voice", dur:"0:18" }
    ];
    snd("dyt7", "voice-b");
    // Parallel Moments, shared a couple of minutes apart
    db.moments.push({ id:"dyp_a", by:A, type:"photo", caption:"My evening, right now.", hasMedia:true, parallel:true, at: NOW - 52 * 60000 });
    db.moments.push({ id:"dyp_b", by:B, type:"photo", caption:"And mine.", hasMedia:true, parallel:true, at: NOW - 50 * 60000 });
    pic("dyp_a", "dusk-2"); pic("dyp_b", "city-dawn");

    /* --- a year of moments, most days, from both --- */
    var days = {}, counted = 0, n, k, recent = [];
    function addMoment(daysAgo, by, hour){
      var who = by === A ? "a" : "b", id = "dym" + (counted++), isText = rnd() < 0.3 && !together(daysAgo), m, name, cap;
      if(isText){
        m = { id:id, by:by, type:"text", caption: pick(WORDS[who]), hasMedia:false, at: at(daysAgo, hour) };
      } else {
        if(together(daysAgo)){ var t = pick(TOGETHER), tt = 0; while(recent.indexOf(t[0]) > -1 && tt++ < 12) t = pick(TOGETHER); name = t[0]; cap = t[1];
          if(inAhmedabad(daysAgo) && /berlin|canal|ferris|lake/.test(name)){ var sw = pick([["rooftops","The terrace, with you on it."],["thali","At the table, both of us. Mum cried."],["chai","Two glasses this time."],["monsoon","One umbrella. Mostly yours."],["road","Drove you out to see the fields."]]); name = sw[0]; cap = sw[1]; }
          if(!inAhmedabad(daysAgo) && /thali|rooftops|chai/.test(name)){ var sb = pick([["berlin-night","Walking home. Both of us."],["snow-market","The market, together. You bought the ugly mug."],["canal","You on my bike. Wobbling."],["street-rain","Ran for the last tram. Missed it. Laughed."]]); name = sb[0]; cap = sb[1]; }
        } else {
          var mo = monthOf(daysAgo), pool = Object.keys(CAP[who]).filter(function(x){ return !SEASON[x] || SEASON[x].indexOf(mo) > -1; });
          // the seasonal ones come up more often in their months
          var seasonal = pool.filter(function(x){ return SEASON[x]; });
          name = seasonal.length && rnd() < 0.14 ? pick(seasonal) : pick(pool.filter(function(x){ return !SEASON[x]; }));
          if(/suitcase|airport|plane|tickets|coffee-two/.test(name)) name = pick(["dusk-1","moon","coffee","rain-window-1","desk","book-blanket"].filter(function(x){ return CAP[who][x]; }));
          // never the same picture twice in a short stretch
          var tries = 0;
          while(recent.indexOf(name) > -1 && tries++ < 12) name = pick(pool.filter(function(x){ return !SEASON[x] && !/suitcase|airport|plane|tickets|coffee-two/.test(x); }));
          cap = pick(CAP[who][name]);
        }
        var asClip = CLIPS.indexOf(name) > -1 && rnd() < 0.6;
        recent.push(name); if(recent.length > 9) recent.shift();
        m = { id:id, by:by, type: asClip ? "video" : "photo", caption:cap, hasMedia:true, at: at(daysAgo, hour) };
        if(asClip) clip(id, name); else pic(id, name);
      }
      db.moments.push(m);
    }
    function travel(daysAgo, by, name, cap, hour){ var id = "dym" + (counted++); db.moments.push({ id:id, by:by, type:"photo", caption:cap, hasMedia:true, at: at(daysAgo, hour) }); pic(id, name); }
    // voice notes through the year: they live in Our Story like everything else
    /* What each voice note says. These are SAMPLE write-ups: the sound in this
       demo is a hummed stand-in, so the words are examples of what Pairlum's
       understanding service would return. [title, feeling, topics, events, words said] */
    var SAID = [
      ["First voice note on Pairlum", "playful", ["Pairlum","new start"], [], "Okay, testing. Is this thing on? This is my first voice note here. I like that it is just us. Good morning from Ahmedabad."],
      ["Walking home in the cold", "missing", ["Berlin","winter"], [], "I am walking home and it is so cold my face hurts. I kept thinking you would laugh at how many layers I am wearing. I miss you tonight."],
      ["Your mum's khichdi", "happy", ["family","food"], ["Dinner at your parents'"], "Your mum sent me the khichdi recipe and I tried it. It was not the same but it was close. Tell her I said thank you."],
      ["Before the big presentation", "worried", ["work","presentation"], ["Work presentation"], "Big presentation tomorrow and I cannot sleep. I just wanted to hear my own voice say it will be fine. Tell me it will be fine."],
      ["It went well", "excited", ["work","presentation"], ["Work presentation"], "It went well! They liked it. I walked out and the first thing I wanted to do was call you. Call me when you wake up."],
      ["Booking the winter visit", "excited", ["travel","visit","flights"], ["Winter visit to Berlin"], "I booked it. I actually booked the flights. Twelve days in Berlin with you. I keep opening the ticket just to look at it."],
      ["Counting down from the airport", "excited", ["travel","airport"], ["Winter visit to Berlin"], "I am at the gate. Nine hours and I am there. Do not be late, I will be the one looking lost with the big suitcase."],
      ["The flat feels too quiet", "missing", ["after the visit","home"], ["Winter visit to Berlin"], "You left this morning and the flat is too quiet. Your mug is still on the windowsill. I am not washing it yet."],
      ["Back to two clocks", "missing", ["time difference","routine"], [], "Back to doing the maths on two clocks. I woke up and reached for you. I miss you more than usual this week."],
      ["Planning our Goa trip", "excited", ["Goa","trip","beach","December"], ["Goa trip in December"], "So I have been thinking about our Goa trip. Five days in December, a small place near Palolem beach, scooters, and no phones after sunset. I looked at flights from Berlin through Mumbai. Say yes and I will book it."],
      ["A song that sounds like us", "loving", ["music"], [], "There is a song playing in the café and it sounds like us. I do not know the name. I am humming it so you can find it."],
      ["I got the job", "happy", ["work","new job"], ["The new job"], "I got it. I got the job! I start in April. I wanted you to be the first person to know."],
      ["Rain on the terrace", "calm", ["monsoon","home","rain"], [], "It is raining on the terrace and everything smells like wet earth. I am just sitting here with chai. I wish you could hear this properly."],
      ["A hard day", "rough", ["work","tired"], [], "Today was hard. Nothing went right and I snapped at someone I should not have. I do not need you to fix it. I just wanted you to know."],
      ["Goa flights are booked", "happy", ["Goa","trip","flights"], ["Goa trip in December"], "Goa is booked! Twelfth to the seventeenth of December. I found the place by Palolem with the hammock. You owe me a sunrise swim."],
      ["Monsoon visit, day one", "happy", ["monsoon","visit","Ahmedabad"], ["Monsoon visit to Ahmedabad"], "You are asleep in the next room and I am whispering this. You are actually here. It rained the second you landed."],
      ["After you left again", "missing", ["after the visit","airport"], ["Monsoon visit to Ahmedabad"], "The airport run never gets easier. I drove back the long way. I miss you already and it has been two hours."],
      ["Diwali without you", "missing", ["Diwali","family","festival"], ["Diwali"], "Everyone is here and the lamps are lit and it is beautiful, and I keep looking for you in the room. Next year you are here for Diwali. Promise."],
      ["Late night, can't sleep", "tired", ["sleep","night"], [], "It is two in the morning and I cannot sleep. I am not sad. I just like falling asleep to your voice so I am leaving mine for you."],
      ["The surprise parcel", "happy", ["gift","parcel"], [], "Your parcel came! How did you remember the tea? I have not opened the letter yet, I am saving it."],
      ["About moving closer", "loving", ["future","moving","plans"], ["Talk about moving"], "I have been thinking about what you said, about one city instead of two. I am not scared of it. I think I want it."],
      ["Our anniversary morning", "loving", ["anniversary"], ["Anniversary"], "Happy anniversary. Four years and I still get nervous before I call you. I love you. That is the whole message."],
      ["Missing you on a Sunday", "missing", ["Sunday","weekend"], [], "Sundays are the worst for missing you. Everyone is out in pairs. I bought two pastries anyway and ate both."],
      ["Good night from me", "calm", ["good night"], [], "Good night. Today was ordinary and good. I wanted you to have the ordinary ones too."]
    ];
    function say(id, entry, source){
      db.understood[id] = { status:"ready", source: source || "demo", at: NOW, title: entry[0], feeling: entry[1], topics: entry[2], events: entry[3], people: [], words: [], transcript: entry[4], language: "en" };
    }
    db.understood = {}; db.replies = []; db.reacts = {};
    [351, 336, 322, 305, 290, 271, 256, 238, 221, 204, 187, 169, 152, 133, 117, 99, 82, 64, 47, 33, 19, 9, 4, 1].forEach(function(d, j){
      var id = "dyv" + j, e = SAID[j];
      // who is speaking follows what is said, so "her new job" is hers and "your mum" is hers to say
      var mine = [0, 5, 6, 8, 12, 15, 16, 17, 20].indexOf(j) > -1;
      db.moments.push({ id:id, by: mine ? A : B, type:"voice", caption:"Voice note", dur: mine ? "0:14" : "0:18", secs: mine ? 14 : 18, hasMedia:true, at: at(d, mine ? 7 : 23) });
      snd(id, mine ? "voice-a" : "voice-b");
      say(id, e);
    });
    say("dyt7", ["Lunch walk", "happy", ["today","Berlin"], [], "I am on my lunch walk and the park has gone completely orange. You would love it. Call me after your demo."]);
    db.moments.forEach(function(m){ if(m.id === "dyt7") m.secs = 18; });

    /* Photos and clips that carry a voice, and the answers they got: the moment around the voice. */
    function withVoice(id, daysAgo, by, type, name, cap, secs, entry, hour){
      var m = { id:id, by:by, type:type, caption:cap, hasMedia:true, at: at(daysAgo, hour || 18), voice: { id: id + "v", secs: secs } };
      if(type === "video"){ m.secs = 8; clip(id, name); } else pic(id, name);
      db.moments.push(m);
      snd(id + "v", by === A ? "voice-a" : "voice-b");
      say(id + "v", entry);
    }
    function answer(id, to, by, kind, daysAgo, hour, entry, clipName){
      db.replies.push({ id:id, to:to, by:by, kind:kind, secs: kind === "clip" ? 8 : (by === A ? 14 : 18), at: at(daysAgo, hour), hasMedia:true });
      if(kind === "clip") clip(id, clipName); else snd(id, by === A ? "voice-a" : "voice-b");
      if(entry) say(id, entry);
    }
    withVoice("dyvp1", 41, B, "photo", "dusk-1", "Sunset from the canal bridge.", 18,
      ["This reminded me of you", "missing", ["sunset","Berlin","canal"], [], "This reminded me of you. The whole sky went pink over the canal and I stood there like an idiot with my phone. I wish you were next to me."]);
    answer("dyrp1", "dyvp1", A, "voice", 41, 21, ["Saving this sunset", "loving", ["sunset"], [], "I am saving this one. Next time we watch a sunset from that bridge together, I am not letting go of your hand."]);
    db.reacts.dyvp1 = {}; db.reacts.dyvp1[A] = "miss";
    withVoice("dyvc1", 203, A, "video", "sea-1", "The sea this morning.", 14,
      ["I wish you were here", "missing", ["sea","beach","morning"], [], "Look at this place. I wish you were here. It is six in the morning and there is nobody on the beach but me and one dog."]);
    answer("dyrc1", "dyvc1", B, "clip", 203, 12, ["From my window, for you", "playful", ["Berlin","snow"], [], "And this is what I have instead. Snow. Grey. Trade you."], "snow-market");
    answer("dyrc2", "dyvc1", A, "voice", 203, 13, ["Trade accepted", "playful", ["sea","snow"], [], "Trade accepted. But only if you bring the snow here."]);
    withVoice("dyvp2", 118, A, "photo", "thali", "Sunday thali.", 14,
      ["Come home and eat", "loving", ["food","Sunday","family"], [], "Mum made the full thali and set a plate for you out of habit. Come home and eat."]);
    db.hearts = db.hearts || {};
    withVoice("dyvp3", 12, B, "photo", "autumn", "The park went orange.", 18,
      ["Autumn walk", "calm", ["autumn","Berlin","walk"], [], "The leaves are doing the thing. I walked the long way round so I could tell you about it."]);
    answer("dyrp3", "dyvp3", A, "voice", 12, 22, ["It is still thirty degrees here", "playful", ["weather"], [], "It is still thirty degrees here. Send some of that autumn over."]);
    // today: her photo carries her voice, and you have not answered yet
    db.moments.forEach(function(m){ if(m.id === "dyt2") m.voice = { id:"dyt2v", secs: 18 }; });
    snd("dyt2v", "voice-b");
    say("dyt2v", ["Two mugs", "loving", ["home","morning","visit"], ["Reunion in Berlin"], "I put two mugs out this morning without thinking. Soon one of them is actually yours."]);
    for(n = 364; n >= 1; n--){
      var quiet = (n % 29 === 7) || (n > 150 && n < 154);          // the odd day nobody opened it
      if(!quiet){ days[String((DK0 - n))] = {}; days[String((DK0 - n))][A] = true; days[String((DK0 - n))][B] = true; }
      else continue;
      var busy = together(n) ? 3 : (rnd() < 0.55 ? 1 : rnd() < 0.6 ? 2 : 0);
      for(k = 0; k < busy; k++) addMoment(n, (n + k) % 2 ? A : B, pick([8, 9, 12, 13, 17, 18, 20, 21, 22]));
    }
    days[String(DK0)] = {}; days[String(DK0)][A] = true; days[String(DK0)][B] = true;
    // the journeys around the two visits
    travel(V1[0] + 6, A, "tickets", "Booked. It's real now.", 21); travel(V1[0] + 2, A, "suitcase", "Packed. Four days early.", 19);
    travel(V1[0] + 1, A, "airport", "Gate 12. Boarding in twenty.", 23); travel(V1[0], A, "plane-window-1", "Above the clouds, on my way to you.", 9);
    travel(V1[1], B, "airport", "Dropped you at BER. Hated every minute.", 18); travel(V1[1], A, "plane-window-2", "The flight home. I hate this view.", 21);
    travel(V2[0] + 9, B, "tickets", "Booked. BER to AMD. I'm shaking.", 20); travel(V2[0] + 1, B, "suitcase", "Half this bag is things you asked for.", 19);
    travel(V2[0], B, "plane-window-1", "Clouds and one very impatient passenger.", 10); travel(V2[0], B, "monsoon", "So THIS is the rain you talk about.", 18);
    travel(V2[1], A, "airport", "Dropped you off. Sat in the car for a while.", 23); travel(V2[1] - 1, B, "plane-window-2", "Flying back. Already counting.", 8);
    db.days = days;

    /* --- memories brought in from before Pairlum, and a few added since --- */
    db.memories = [];
    var OLD = [
      ["coffee-two","The cafe where it started."],["candle-dinner","Third date. You ordered for me."],["dusk-1","The evening you said it first."],["rooftops","My terrace, your first time up here."],
      ["kites","Our first Uttarayan."],["thali","Meeting my parents. You were so nervous."],["road","The drive to Udaipur."],["lake","Udaipur, the boat we couldn't afford."],
      ["movie-night","The film we never finished."],["flowers-1","First flowers. I panicked and bought too many."],["polaroids","Photo booth, four tries."],["fairy-lights","Your old room."],
      ["monsoon","Caught in it on the scooter."],["chai","Chai at 1am after the wedding."],["stars","The night we drove out of the city."],["sea-1","Diu. Our first trip."],
      ["beach","We had the whole beach."],["mountains-1","Abu, freezing, happy."],["train-window","The overnight train."],["diyas","First Diwali together."],
      ["letter","The first letter you ever wrote me."],["gift","Your birthday. You guessed it anyway."],["pancakes","You tried to cook. Bless you."],["book-blanket","Rainy Sunday, nowhere to be."],
      ["record","Dancing in the kitchen."],["tickets","The visa appointment."],["suitcase","Packing for Berlin."],["airport","The first goodbye."],
      ["plane-window-1","Your flight. I watched it on the tracker."],["berlin-night","First photo you sent from there."],["video-call","Our first call across the distance."],["bedroom","Falling asleep on video, the first time."],
      ["rain-window-1","The winter we don't talk about."],["street-rain","You walked home in this to call me."],["snow-market","Your first Berlin Christmas."],["fireworks","New year, two midnights."],
      ["blossom","Spring, and things got lighter."],["canal","The canal you kept telling me about."],["ferris","Our first reunion. We went on it twice."],["garden-path","Tiergarten, holding hands like teenagers."],
      ["dusk-2","The last evening of that trip."],["plane-window-2","Flying home, the first time."],["windowsill","Your flat. Two mugs."],["city-dawn","5am, couldn't sleep, didn't want to."],
      ["moon","Same moon. We started saying it here."],["sea-2","The Baltic. So cold."],["mountains-2","The weekend in the hills."],["desk","My first day at the new job."],
      ["autumn","Autumn in your city."],["dusk-3","Morning after the long call."],["flowers-2","You sent these to my office."],["city-night","The night bus home."],
      ["coffee","Your mug. I kept it."],["rain-window-2","Rain on the day you left."]
    ];
    var startOld = new Date(2022, 2, 12).getTime(), endOld = NOW - 372 * DAY, i, cursor = 0, usedThisYear = {};
    for(i = 0; i < 132; i++){
      var frac = (i + rnd() * 0.8) / 132, ts = startOld + frac * (endOld - startOld), when = new Date(ts), mo = when.getMonth() + 1, yr = when.getFullYear();
      // a seasonal picture first when its month comes round (once a year), otherwise the next one that fits
      var o = null, s;
      for(s = 0; s < OLD.length && !o; s++){ if(SEASON[OLD[s][0]] && inSeason(OLD[s][0], mo) && !usedThisYear[yr + OLD[s][0]] && rnd() < 0.7){ o = OLD[s]; usedThisYear[yr + OLD[s][0]] = 1; } }
      for(s = 0; s < OLD.length && !o; s++){ var cand = OLD[(cursor + s) % OLD.length]; if(!SEASON[cand[0]]){ o = cand; cursor = (cursor + s + 1) % OLD.length; } }
      var id = "dyi" + i, isClip = CLIPS.indexOf(o[0]) > -1 && i % 2 === 0;
      db.memories.push({ id:id, by: i % 3 === 0 ? B : A, type: isClip ? "video" : "photo", date: iso(when), dateSource:"camera", caption: (i % 3 !== 1) ? o[1] : "", src:"demo|" + i, preview: IMG + o[0] + ".jpg", at: NOW - (362 - (i % 40)) * DAY });
      if(isClip) clip(id, o[0]); else pic(id, o[0]);
    }
    // the same calendar day in earlier years, so "On this day" has something to bring back
    var today = new Date(NOW);
    [[1, "blossom", "One year ago. We'd just joined Pairlum, and this was the first thing you sent."], [2, "ferris", "Two years ago today. The first reunion."], [3, "dusk-1", "Three years ago. Before any of the distance."]].forEach(function(row, j){
      var d = new Date(today.getFullYear() - row[0], today.getMonth(), today.getDate()), id = "dyo" + j;
      if(d.getTime() < startOld) return;
      db.memories.push({ id:id, by: j % 2 ? A : B, type:"photo", date: iso(d), dateSource:"camera", caption: row[2], src:"demo|otd" + j, preview: IMG + row[1] + ".jpg", at: NOW - 300 * DAY });
      pic(id, row[1]);
    });
    // a handful Mira added this week
    [["polaroids","Found the photo booth strip in my coat."],["record","The flea market, last spring."],["lake","Wannsee, the day you called for three hours."]].forEach(function(row, j){
      var id = "dyn" + j;
      db.memories.push({ id:id, by:B, type:"photo", date: isoAgo(170 + j * 40), dateSource:"camera", caption: row[1], src:"demo|new" + j, preview: IMG + row[0] + ".jpg", at: NOW - (2 + j) * 3600000 });
      pic(id, row[0]);
    });

    /* --- chapters: the story so far, with the past year named --- */
    db.chapters = [
      { id:"dyc1", demo:true, title:"Where it started", date:"2022-03-12", photo:"dy-coffee-two", note:"Same city, same group of friends, way too many excuses to end up at the same table." },
      { id:"dyc2", demo:true, title:"Long distance begins", date:"2024-02-01", photo:"dy-airport", note:"Her visa came through two weeks before the flight. We didn't talk about the goodbye until the drive to the airport." },
      { id:"dyc3", demo:true, title:"Our first reunion", date:"2024-06-01", photo:"dy-ferris", note:"Four months apart, then arrivals hall, then neither of us said anything for a good ten seconds." },
      { id:"dyc4", demo:true, title:"The hard winter", date:"2025-01-01", photo:"dy-rain-window-1", note:"The season neither of us likes to talk about much. We got through it in small pieces, most days by phone." },
      { id:"dyc5", by:A, title:"The year we started keeping it", date: isoAgo(365), photo:"dy-polaroids", note:"We joined Pairlum on a Tuesday and didn't miss many days after that. This is where the daily things start." },
      { id:"dyc6", by:B, title:"Ten days in Berlin", date: isoAgo(V1[0]), photo:"dy-snow-market", note:"He landed in the snow with one bag and half of it was snacks. We did nothing special and it was the best ten days of the year." },
      { id:"dyc7", by:A, title:"Back to two clocks", date: isoAgo(V1[1] - 1), photo:"dy-plane-window-2", note:"The flat was too quiet for a week. Then we found the rhythm again: mornings for her, nights for me." },
      { id:"dyc8", by:B, title:"Her new job, his new flat", date: isoAgo(196), photo:"dy-desk", note:"Two big changes in the same month, both done over video. We unpacked his boxes together, four and a half hours apart." },
      { id:"dyc9", by:A, title:"The monsoon visit", date: isoAgo(V2[0]), photo:"dy-monsoon", note:"She finally saw the rain I keep talking about. Nine days, one family lunch that lasted five hours, and a lot of chai." },
      { id:"dyc10", by:B, title:"Counting down again", date: isoAgo(V2[1] - 1), photo:"dy-moon", note:"Still two cities, still a countdown on the home screen. " + REUNION_IN + " days to go as this is written." }
    ];

    /* --- little notes (the app keeps the last 60) --- */
    db.notes = [];
    var tNote = NOW - 25 * 60000;
    for(i = 0; i < 60; i++){
      var whoN = i % 2 === 0 ? "b" : "a";
      db.notes.push({ id:"dynote" + i, by: whoN === "a" ? A : B, text: NOTE_POOL[whoN][Math.floor(i / 2) % 30], at: tNote });
      tNote -= between(2, 30) * 3600000;
    }

    /* --- letters --- */
    function letter(id, by, title, body, daysAgo, openIn, extra){
      var l = { id:id, by:by, from: by === A ? "Aarav" : "Mira", title:title, body:body, createdAt: NOW - daysAgo * DAY, openDate: null, state:"Unlocked anytime", locked:false, song:null, photos:[] };
      if(openIn !== null && openIn !== undefined){ l.openDate = iso(new Date(NOW + openIn * DAY)); l.locked = openIn > 0; l.state = l.locked ? "Opens" : "Opened"; }
      if(extra) Object.keys(extra).forEach(function(x){ l[x] = extra[x]; });
      return l;
    }
    db.letters = [
      letter("dyl1", B, "For the morning of your demo", "By the time you read this you'll have done it, and I'll have been asleep for the scary part. I want you to know I wasn't worried for a second. You explain things the way you explain them to me: slowly, kindly, like the other person matters. That's all it ever takes. Call me the minute you're out. I don't care what time it is here.", 0.2, 0),
      letter("dyl2", B, "Open when the countdown hits single digits", "Sealed.", 4, REUNION_IN - 9),
      letter("dyl3", A, "For the night before you fly", "Sealed.", 6, REUNION_IN - 1),
      letter("dyl4", B, "Our five-year letter", "Sealed.", 40, 157),
      letter("dyl5", A, "Open on your birthday", "Sealed.", 12, 28),
      letter("dyl6", A, "One year of this", "A year ago you sent me a link and said 'humour me'. I did, because it was you. Since then there hasn't been a week I didn't know what your morning looked like. I know your window, your mug, the tram you just missed. I didn't know I needed that until I had it. The distance is the same number of kilometres. It just doesn't feel as far. Thank you for making me do this.", 2, null, { photos:[IMG + "polaroids.jpg", IMG + "coffee-two.jpg"] }),
      letter("dyl7", B, "After the monsoon", "I'm writing this at the gate. My hair still smells like your city's rain. Your mother packed me food for a flight that serves food. Your father shook my hand for too long and then hugged me anyway. I keep thinking about the terrace, and how you went quiet when the sky turned. I understood something about you up there. I'll tell you in person. Nine days wasn't enough but it was exactly right.", 79, null, { photos:[IMG + "monsoon.jpg", IMG + "rooftops.jpg", IMG + "chai.jpg"] }),
      letter("dyl8", A, "Read whenever you miss me most", "If you're reading this it's one of those nights. Here's what I need you to remember: the distance is temporary and annoying, not a sign of anything. I'm not going anywhere. Put your phone face down for ten minutes, drink some water, then text me even if it's just 'miss you'. I'll always answer.", 150, null),
      letter("dyl9", B, "For your first night in the new flat", "It's going to echo and you're going to hate it for exactly one evening. Then you'll put the lights up, and the record on, and it'll be yours. I've already decided which side of the sofa is mine. Don't unpack the kitchen without me on call.", 195, -195),
      letter("dyl10", A, "The day you got the job", "I knew before you did. You'd been talking about it like someone who'd already started. I'm writing this before the answer comes so you know I meant it either way: they'd be lucky. You've always been the most capable person in any room, and the last to notice.", 201, -200),
      letter("dyl11", B, "For the next hard winter", "We got through the last one by being stubborn together. If we're in another one now, same plan. Small pieces, most days by phone, no pretending it's easy. I love you on the easy days and the hard ones.", 240, null),
      letter("dyl12", A, "After Berlin", "The flat smells like the airport. I found your scarf in my bag and I'm not giving it back. Ten days and we didn't do a single thing a guidebook would recommend, and I'd do it again exactly the same. I've started a list for next time. It's just 'more of that'.", 289, null, { photos:[IMG + "snow-market.jpg", IMG + "berlin-night.jpg"] }),
      letter("dyl13", B, "Open at midnight, your time", "Happy new year, for the second time tonight. I celebrated yours at 7:30 in the evening on my sofa with a sparkler from the corner shop. Next year, one midnight. That's the only resolution.", 279, -278),
      letter("dyl14", A, "For when work is too much", "You don't have to be impressive today. You just have to get to the evening. I'll be there at the other end of it with nothing useful to say and all the time in the world.", 120, null),
      letter("dyl15", B, "On your mum's birthday", "Tell her the recipe worked. Tell her I burned it the first three times. Tell her I'm practising for when I'm at her table again.", 215, -214),
      letter("dyl16", A, "Six months in", "I looked back at the first week today. We were so careful with each other on here, like it might break. Now you send me a photo of a pigeon at 7am with no caption and I know exactly what you mean.", 182, null),
      letter("dyl17", B, "For the flight home from Berlin", "You're somewhere over Turkey and I'm on your side of the bed. I'm not sad the way I was the first time. It's a different thing now. More like waiting than missing.", 290, -290),
      letter("dyl18", A, "Diwali, apart", "I lit one for you on the terrace. My cousin asked who the extra diya was for and my aunt answered before I could. Everyone knows. Everyone's waiting for you.", 345, null, { photos:[IMG + "diyas.jpg"] }),
      letter("dyl19", B, "The first one on here", "Okay. Trying this. It feels strange to write a letter into an app, but it felt strange to love someone through a phone too, and look how that turned out.", 362, null),
      letter("dyl20", A, "For a day you feel far away", "You're not far. You're four and a half hours and one phone call. That's nothing. People wait longer for a table.", 98, null),
      letter("dyl21", B, "Things I never said properly", "Thank you for learning the time difference before I'd even unpacked. Thank you for never once making me feel guilty for leaving. Thank you for staying up. I notice all of it.", 60, null),
      letter("dyl22", A, "Before the monsoon visit", "Eleven days. I've cleaned the flat twice. My mother has a menu. I have a list of places and I already know we'll ignore it and sit on the terrace.", 99, -88),
      letter("dyl23", B, "Open when you can't sleep", "Count the things we've already got through. Start with the first goodbye. By the time you reach this year, you'll be asleep.", 130, null),
      letter("dyl24", A, "For your first snow of the year", "Send me a photo before you do anything else. Then go and stand in it for both of us.", 310, -302)
    ];

    /* --- someday list --- */
    var SD = [["Christmas markets in Berlin, together",B,true],["Cook a full Gujarati thali for two",A,true],["A whole week in the same time zone",B,true],["Ride the big wheel twice",A,true],
      ["Meet your parents properly",B,true],["See the monsoon from your terrace",B,true],["Fly a kite on Uttarayan, both of us",A,false],["Watch a whole series without spoilers",B,true],
      ["Photo booth, a full strip, no blinking",B,true],["Take the night train somewhere",A,false],["One midnight on New Year's Eve, not two",B,false],["Find a flat with a window seat",A,false],
      ["Learn ten proper phrases in German",A,true],["Learn to make rotli that's actually round",B,true],["Swim in a lake in summer",B,true],["Drive to Udaipur again",A,false],
      ["A week with no phones, when we don't need them",B,false],["Adopt the neighbours' dog (legally)",A,false],["Dance in a kitchen that's ours",A,false],["Print the Book and read it on the same sofa",B,false],
      ["See the northern lights",B,false],["Host one dinner, together, for everyone",A,true]];
    db.someday = SD.map(function(x, j){ return { id:"dysd" + j, by:x[1], text:x[0], done:x[2], at: NOW - (j * 15 + 3) * DAY }; });

    /* --- I Need You, over the year --- */
    var NEEDS = ["Hear their voice","Reassurance","Stay with me","Distract me","Help me sleep","Just wanted you to know"];
    db.requests = [];
    [352, 330, 318, 284, 260, 247, 233, 210, 190, 171, 149, 131, 118, 96, 71, 55, 39, 24, 11, 3].forEach(function(d, j){
      db.requests.push({ id:"dyr" + j, by: j % 2 ? A : B, title: NEEDS[j % NEEDS.length], note: j % 3 === 0 ? pick(["Long day. Nothing wrong, just need you.","Can't switch my head off tonight.","Missing you more than usual."]) : "", voice:false, hasVoice:false, noReply: j % 5 === 0, sentAt: at(d, 22), status:"delivered", reply:"here", replyAt: at(d, 22) + between(1, 9) * 60000 });
    });

    db.requests[db.requests.length - 1].urgent = true;            // one that could not wait
    db.requests[db.requests.length - 3].reply = "later";          // and one answered "not right now"
    // each of them has left the other a message for the hard days
    db.comfort = {};
    db.comfort[A] = { id:"dycomfort_a", secs:20, at: NOW - 61 * DAY }; snd("dycomfort_a", "comfort-a");
    db.comfort[B] = { id:"dycomfort_b", secs:24, at: NOW - 2 * DAY };  snd("dycomfort_b", "comfort-b");

    /* --- dates, plans, reunion --- */
    db.dates = [
      { id:"dyd1", by:A, title:"The day we met", month:3, day:12 }, { id:"dyd2", by:B, title:"The first goodbye", month:2, day:1 },
      { id:"dyd3", by:A, title:"First reunion", month:6, day:1 }, { id:"dyd4", by:B, title:"The day we joined Pairlum", month: today.getMonth() + 1, day: today.getDate() },
      { id:"dyd5", by:A, title:"Mira's mum's birthday", month:3, day:5 }
    ];
    var eve = new Date(NOW); eve.setMinutes(0, 0, 0);
    db.plans = [
      { id:"dyp1", by:B, title:"Tonight's call", at: NOW + 2 * 3600000 + 20 * 60000 },
      { id:"dyp2", by:A, title:"Movie night: your pick", at: NOW + 3 * DAY + 5 * 3600000 },
      { id:"dyp3", by:B, title:"Sunday pancakes, on video", at: NOW + 5 * DAY - 6 * 3600000 },
      { id:"dyp4", by:A, title:"Book the airport taxi together", at: NOW + 12 * DAY },
      { id:"dyp5", by:B, title:"Landing in Berlin", at: NOW + REUNION_IN * DAY }
    ];
    db.reunion = { date: iso(new Date(NOW + REUNION_IN * DAY)), place:"Berlin", by:B, at: NOW - 70 * DAY };

    /* --- today's small things --- */
    var dayKey = String(DK0);
    db.feel = {}; db.feel[dayKey] = {}; db.feel[dayKey][A] = "happy"; db.feel[dayKey][B] = "missing";
    db.hearts = { dyt1:{}, dyt2:{}, dyt4:{}, dyt6:{}, dyvp2:{}, dyvp3:{} };
    db.hearts.dyvp2[B] = true; db.hearts.dyvp3[A] = true;
    db.hearts.dyt1[B] = true; db.hearts.dyt2[A] = true; db.hearts.dyt4[A] = true; db.hearts.dyt6[A] = true;
    db.dq = {};
    var QTEXT = ["What's a small thing I did recently that made you smile?", "What are you looking forward to this week?", "What's something about long distance you've gotten weirdly good at?", "If we were in the same city tonight, what would we do?", "What's a memory of us you've thought about recently?", "What's one thing you need more of from me right now?", "What's something you're proud of this week?"];
    var ANS_A = ["When you sent the weather before I asked.","Thursday. Nothing after it, so we can actually talk.","Falling asleep on a call without it being strange.","Nothing. Cook, argue about music, fall asleep on the sofa.","The airport, the first time. It still gets me.","Your voice notes. More of those.","I called without checking the time first."];
    var ANS_B = ["You texted me the weather in Ahmedabad before I even asked.","Thursday's call. Nothing scheduled after.","Doing the maths on two time zones without thinking.","Your terrace, tea, and not talking for a while.","The terrace in the monsoon. You went quiet.","Just more mornings. I like your mornings.","I told my boss no. Politely. But no."];
    for(n = 0; n < 120; n++){
      if(n % 9 === 4) continue;
      var key = String(DK0 - n);
      var qi = (DK0 - n) % 7;
      db.dq[key] = { _q: { id: "q0" + (qi + 1), text: QTEXT[qi] } };   // the question travels with its answers
      db.dq[key][A] = ANS_A[qi]; db.dq[key][B] = ANS_B[qi];
    }
    delete db.dq[dayKey][A];                                    // Mira has answered today; yours is waiting

    db.quiz = { round: 21, answers: {} };
    for(n = 0; n <= 21; n++){
      db.quiz.answers[n] = {};
      db.quiz.answers[n][A] = { self:[0,2,3,1,2].map(function(v, j){ return (v + n + j) % 4; }), guess:[1,2,0,1,3].map(function(v, j){ return (v + n * 2 + j) % 4; }), at: NOW - (21 - n) * 16 * DAY - DAY };
      db.quiz.answers[n][B] = { self:[1,2,0,1,3].map(function(v, j){ return (v + n * 2 + j) % 4; }), guess:[0,2,3,3,2].map(function(v, j){ return (v + n + j) % 4; }), at: NOW - (21 - n) * 16 * DAY - DAY / 2 };
    }
    db.ambient = {}; db.ambient[B] = { id:"dyamb_b", label:"Rain on my window, and the tram", secs: 38, at: NOW - 40 * 60000 };
    db.ambient[A] = { id:"dyamb_a", label:"The terrace at dusk. Birds, traffic.", secs: 45, at: NOW - 26 * 3600000 };
    db.sleep = {}; db.sleep[A] = { asleep:false, at: NOW - 9 * 3600000 }; db.sleep[B] = { asleep:false, at: NOW - 5 * 3600000 };
    db.hold = { best: 94, last: 31, at: NOW - 20 * 3600000 };
    db.liveLog = [];
    for(n = 0; n < 20; n++) db.liveLog.push({ id:"dylive" + n, sharer: n % 2 ? A : B, listener: n % 2 ? B : A, at: NOW - (n * 13 + 1) * DAY - between(1, 9) * 3600000, secs: between(140, 2400) });
    db.liveLog.reverse();
    db.prefs = {}; // both have switched on "save your originals", so either export is complete
    [A, B].forEach(function(u){ db.prefs[u] = { liveRequests:true, media: { saveOriginals:true, downloadVideo:true } }; });

    /* --- who they are --- */
    db.profiles = {};
    db.facts = {};
    db.facts[A] = { drink:"Cutting chai. Coffee only before 9am.", comfort:"Mum's khichdi with too much ghee", flower:"Marigolds. Don't tell anyone.", sizes:"Ring 20 · Shoe 43 · Shirt M", sad:"Ten quiet minutes, then your voice", gift:"A proper record player" };
    db.facts[B] = { drink:"Flat white, extra hot. Chai if you're making it.", comfort:"Dal and rice, the way your mum makes it", flower:"Peonies, or anything yellow", sizes:"Ring 16 · Shoe 38 · Dress S", sad:"To be asked once, then just held", gift:"A film camera I'd never justify" };
    db.dna = {
      people: {},
      things: {
        "Songs":["Kesariya","Tum Se Hi","Golden Hour","Apocalypse","Iktara"], "Films & shows":["Before Sunrise","Wake Up Sid","Dark","Past Lives","Piku"],
        "Foods":["Khichdi","Döner at 1am","Pancakes on Sunday","Masala chai","Cinnamon buns"], "Places":["Your terrace","The canal bench","Udaipur","Wannsee","The airport bookshop"],
        "Games":["Wordle, competitively","Ludo on call","20 questions"], "Artists":["Prateek Kuhad","Cigarettes After Sex","Arijit Singh","Phoebe Bridgers"],
        "Hobbies":["Film photography","Baking badly","Evening walks"], "Date types":["Same film, two sofas","Cook the same dish","Walk and talk on call","Breakfast for dinner"],
        "Things to try":["A pottery class","A night train","Learning to dance, properly","A week offline"]
      },
      language: { nicknames:["Miru","Aaru","Captain","Sleepyhead"], jokes:["The samosa incident","Gate 12","'I blacked out for the middle part'","The pigeon"], words:["Soon","Terrace","Proper","Tuesday"],
        phrases:["Same moon","Carry on","Text me when you land","One more sleep"], emojis:["🌙","☕","🪁","🧣"], morning:["Good morning from four and a half hours behind","Up?"], goodbye:"Same moon. Goodnight." },
      priorities: ["Everyday moments","Voice","Plans & reunion","Letters","The Book"],
      rituals: [
        { id:"dyrit1", name:"Friday midnight call", freq:"weekly", by:A, at: NOW - 350 * DAY, count: 48, last: NOW - 4 * DAY },
        { id:"dyrit2", name:"Morning photo before work", freq:"daily", by:B, at: NOW - 340 * DAY, count: 301, last: NOW - 6 * 3600000 },
        { id:"dyrit3", name:"Same film, two sofas", freq:"weekly", by:B, at: NOW - 300 * DAY, count: 37, last: NOW - 9 * DAY },
        { id:"dyrit4", name:"Sunday pancakes on video", freq:"weekly", by:A, at: NOW - 250 * DAY, count: 31, last: NOW - 2 * DAY },
        { id:"dyrit5", name:"A letter on the 12th", freq:"monthly", by:A, at: NOW - 330 * DAY, count: 11, last: NOW - 24 * DAY },
        { id:"dyrit6", name:"Goodnight voice note", freq:"daily", by:B, at: NOW - 280 * DAY, count: 262, last: NOW - 14 * 3600000 }
      ],
      collections: [
        { id:"dycol1", emoji:"😴", name:"Things you say half asleep", by:A, at: NOW - 320 * DAY, items:["'No, you hang up' (she was asleep)","'Is the tram a fish'","'Five more minutes' ×40","'I'm listening' (snoring)","'Tell the moon I said hi'"] },
        { id:"dycol2", emoji:"✈️", name:"Airports we've cried in", by:B, at: NOW - 300 * DAY, items:["AMD departures, twice","BER, gate B14","Istanbul, on a layover, for no reason"] },
        { id:"dycol3", emoji:"🥟", name:"Bad food, good nights", by:A, at: NOW - 210 * DAY, items:["The samosas","My first dal","Her round-ish rotli","Airport sandwich, shared","3am instant noodles on call"] },
        { id:"dycol4", emoji:"🎬", name:"Films we didn't finish", by:B, at: NOW - 180 * DAY, items:["The one with the boat","Anything after 11pm his time","That documentary","Dark, season 2"] },
        { id:"dycol5", emoji:"🌙", name:"Same-moon nights", by:B, at: NOW - 140 * DAY, items:["The night before Berlin","Diwali","New year, both midnights","Tonight, probably"] },
        { id:"dycol6", emoji:"🪁", name:"Firsts this year", by:A, at: NOW - 100 * DAY, items:["First snow, in person","First monsoon, in person","First family lunch","First shared sofa in ten months","First letter that made me cry at work"] }
      ].map(function(c){ c.items = c.items.map(function(t, j){ return { id:c.id + "i" + j, text:t, by: j % 2 ? A : B, at: c.at + (j + 1) * 9 * DAY }; }).reverse(); return c; }),
      season: "Planning Reunion"
    };
    db.dna.people[A] = { set:true, specs:{ social:34, tone:62, romance:71, plan:28, expressive:58, calls:83, depth:66, freq:77 }, love:["Quality time","Words","Acts of service"], media:["Voice","Photos"], fb:{ ritual:2, deep:1, playful:2, photo:1, music:1 } };
    db.dna.people[B] = { set:true, specs:{ social:51, tone:44, romance:64, plan:79, expressive:72, calls:46, depth:81, freq:69 }, love:["Words","Quality time","Touch"], media:["Photos","Words"], fb:{ ritual:1, deep:3, playful:1, photo:2, music:0 } };

    db.membership = { plan:"book", since: isoAgo(365), by:A };
    db.stats = { totalMoments: 4286 };                          // the running count a server would keep
    return db;
  }

  /* ---------- 5. write it, once a day ---------- */
  function seedAll(){
    var db = build();
    ls.setItem("pairlum-shared-space-v1", JSON.stringify(db));
    // the connection is one fact for the space; settings are private to each person
    ls.setItem("pairlum-pairing-v1", JSON.stringify({ status:"joined", inviteCode:null, inviteSentAt:null, joinedAt: new Date(NOW - 365 * DAY).toISOString() }));
    [A, B].forEach(function(u){ ls.setItem("pairlum-space-settings-v1-" + u, JSON.stringify({ hasImportedPast: true })); });
    var newsA = [
      ["notes", "Mira was thinking of you", "home", "notesRow", 25, false], ["ambient", "A new sound from where Mira is", "home", "ambientCard", 40, false],
      ["moments", "Mira shared a little piece of the day", "home", "sharedDayGrid", 50, false], ["games", "Mira answered today's question", "home", "dqFlip", 95, false],
      ["letters", "A letter from Mira: “For the morning of your demo”", "letters", "lettersList", 290, true], ["hearts", "Mira loved your moment", "home", "sharedDayGrid", 300, true],
      ["plans", "Mira added a plan: Tonight's call", "home", "plansBlock", 420, true], ["sleep", "Mira is awake. Good morning from Berlin.", "home", "", 480, true],
      ["memories", "Mira added 3 memories", "story", "memoryTimeline", 600, true], ["sleep", "Mira went to sleep. Good night.", "home", "", 1010, true],
      ["need", "Mira could use reassurance", "home", "needIncoming", 4200, true], ["reunion", "23 days until Berlin", "home", "plansBlock", 1500, true],
      ["notes", "Mira thought of you 4 times", "home", "notesRow", 1700, true], ["games", "You both played Know each other: 4 of 5", "home", "quizCard", 2900, true],
      ["letters", "A sealed letter from Mira opens in 14 days", "letters", "lettersList", 5800, true], ["us", "Mira added to Our DNA: Things you say half asleep", "us", "dnaCard", 7200, true],
      ["dates", "One year on Pairlum today", "us", "datesList", 180, true], ["moments", "Mira shared 3 moments yesterday", "home", "sharedDayGrid", 1500, true],
      ["plans", "Movie night: your pick, in 3 days", "home", "plansBlock", 2000, true], ["ambient", "Mira listened to your terrace for 12 minutes", "home", "ambientCard", 2600, true],
      ["hearts", "Mira loved 5 of your moments this week", "home", "sharedDayGrid", 8600, true], ["us", "Your year is complete. Your Pairlum Book can be made.", "us", "bookSection", 120, false]
    ];
    function inbox(list, name){ return list.map(function(x, j){ return { id:"dynt" + j, type:x[0], text: name ? x[1].replace(/Mira/g, name) : x[1], view:x[2], target:x[3], at: NOW - x[4] * 60000, read:x[5], held:false }; }).sort(function(p, q){ return q.at - p.at; }); }
    ls.setItem("pairlum-inbox-v1-" + A, JSON.stringify(inbox(newsA)));
    ls.setItem("pairlum-inbox-v1-" + B, JSON.stringify(inbox(newsA.slice(0, 16), "Aarav")));
    var seen = NOW - 3 * 3600000, firsts = { moment:1, parallel:1, letter:1, "import":1, chapter:1, dna:1, dq:1, thinking:1, photoView:1 };
    [A, B].forEach(function(u){
      ls.setItem("pairlum-seen-v1-" + u, JSON.stringify({ notes:seen, moments:seen, letters:seen, memories:seen, ambient:seen }));
      ls.setItem("pairlum-firsts-v1-" + u, JSON.stringify(firsts));
    });
    ls.setItem("pairlum-demo-seeded", iso(new Date(NOW)));
    ls.setItem("pairlum-demo-media", JSON.stringify(MEDIA));
    ls.setItem("pairlum-demo-posters", JSON.stringify(POSTERS));
  }
  var stale = true;
  try{ stale = ls.getItem("pairlum-demo-seeded") !== iso(new Date(NOW)) || /(?:^|[?&])demo=year(?:&|$)/.test(location.search) && /(?:^|[?&])fresh=1(?:&|$)/.test(location.search); }catch(e){}
  if(stale){ try{ seedAll(); }catch(e){ if(window.console) console.error("Pairlum demo could not be prepared", e); } }
  else { try{ MEDIA = JSON.parse(ls.getItem("pairlum-demo-media")) || {}; POSTERS = JSON.parse(ls.getItem("pairlum-demo-posters")) || {}; }catch(e){ MEDIA = {}; POSTERS = {}; } }
  window.PAIRLUM_DEMO = "year";
  window.PAIRLUM_DEMO_MEDIA = MEDIA;
  window.PAIRLUM_DEMO_POSTERS = POSTERS;

  /* ---------- 6. the pictures behind every photo tile ---------- */
  var css = ALL.map(function(n){ return ".photo--dy-" + n + "{background-image:url(\"" + IMG + n + ".jpg\")}"; }).join("");
  var swap = { "coffee":"coffee", "commute":"street-rain", "desk":"desk", "train":"train-window", "rain":"rain-window-1", "sky":"dusk-3", "bedroom":"bedroom", "call":"video-call", "airport":"airport", "reunion":"ferris", "berlin-night":"berlin-night", "ahmedabad-morn":"rooftops", "sunset-two":"dusk-2", "first-photo":"coffee-two" };
  css += Object.keys(swap).map(function(k){ return ".photo.photo--" + k + "{background-image:url(\"" + IMG + swap[k] + ".jpg\")}"; }).join("");
  css += ".demo-note{margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);font-size:.8rem;line-height:1.5;color:var(--ink-faint)}.demo-note b{color:var(--ink);font-weight:600}";
  var st = document.createElement("style"); st.setAttribute("data-pairlum-demo", ""); st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* ---------- 7. a few fixed lines on the page that describe the demo couple ---------- */
  document.addEventListener("DOMContentLoaded", function(){
    function q(sel){ return document.querySelector(sel); }
    var box = q("#viewingAs");
    if(box){
      var open = q("#viewingAsOpen");
      if(open){ var fix = function(){ var h = open.getAttribute("href") || ""; if(h.indexOf("demo=year") < 0) open.setAttribute("href", h + (h.indexOf("?") > -1 ? "&" : "?") + "demo=year"); }; fix(); window.setTimeout(fix, 400); }
      var link = q("#demoYearLink");
      if(link){ link.textContent = "Leave the one-year demo"; link.setAttribute("href", "?demo=off"); }
      var note = document.createElement("p");
      note.className = "demo-note";
      note.innerHTML = "<b>Demo: one year of heavy use.</b> A made-up couple, a year of daily moments, notes, letters and plans. Your own space is untouched. The demo starts fresh each day, so anything you change here lasts until tomorrow.";
      box.appendChild(note);
    }
    // Home → "From your story" and the Our Story strip, written for this couple's year
    var res = q(".resurfaced");
    if(res){
      var ph = res.querySelector(".photo"); if(ph) ph.className = "photo photo--dy-snow-market";
      var parts = res.querySelectorAll(".moment-meta > *");
      if(parts[0]) parts[0].textContent = "10 months ago";
      if(parts[1]) parts[1].textContent = "The night he landed in the snow.";
      if(parts[2]) parts[2].textContent = "Berlin · arrivals, 9:40 PM";
    }
    var tiles = document.querySelectorAll(".history-row .history-tile");
    [["dy-monsoon", "The monsoon visit"], ["dy-desk", "Her new job, his new flat"], ["dy-snow-market", "Ten days in Berlin"], ["dy-polaroids", "The year we started keeping it"]].forEach(function(row, i){
      var t = tiles[i]; if(!t) return;
      var p = t.querySelector(".photo"); if(p) p.className = "photo photo--" + row[0];
      var cap = t.querySelector(".moment-caption"); if(cap) cap.textContent = row[1];
      var when = t.querySelector(".mono");
      if(when){ var d = new Date(NOW - [88, 196, 300, 365][i] * DAY); when.textContent = new Intl.DateTimeFormat("en-US", { month:"short", year:"numeric" }).format(d); }
    });
  });
})();
