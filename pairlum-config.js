// App settings, shared by every page (the landing site, auth, pricing, the
// dashboard). googleClientId: paste the "Client ID" of your Google Cloud
// OAuth web client here to switch on "From Google Photos" in Import Memories.
window.PAIRLUM_CONFIG = {
  googleClientId: "426616985265-ofia9squbtjraqjl4lc6vd6o5bgrms3n.apps.googleusercontent.com",

  // Supabase project, once one exists. While empty, everything (auth.html,
  // app.html, the dashboard itself) runs its local-only demo instead of a
  // real account system — see supabase/SETUP.md for how to connect one.
  supabaseUrl: "https://kbbqfwejhbacizfzgqdx.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiYnFmd2VqaGJhY2l6ZnpncWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTI4ODYsImV4cCI6MjEwNzAyODg4Nn0.mzgLivsajVQvwz40ESqSX7F_JwMH6X0SUi0rXEhYId4",

  // Optional: override WebRTC's ICE servers for "I Need You" live listening
  // if the default public STUN server isn't enough for your network (a
  // private TURN server, for example). Leave unset to use Google's public
  // STUN server. Shape: [{ urls: "stun:..." }, { urls: "turn:...", username, credential }]
  // iceServers: [{ urls: "stun:stun.l.google.com:19302" }],

  // Recording write-ups (transcript, title, feeling, topics) and search by
  // meaning. Leave as null until Pairlum's understanding service exists.
  // To connect it: understand: { url: "https://…", token: "…" }
  // While it is null, no recording ever leaves the device.
  understand: null,

  // Membership. Exactly two paid plans — change the prices here and nowhere
  // else. amount: null shows "Price announced before launch".
  currency: "INR",
  locale: "en-IN",
  plans: [
    {
      id: "digital", name: "Pairlum Digital Membership", short: "Digital Membership", amount: 5999, period: "year",
      line: "Your whole shared world, kept and growing.",
      features: [
        "Shared Day, I Need You and Thinking of You",
        "Our Story: chapters, timeline and imported memories",
        "Letters, plans and your reunion countdown",
        "The sound of where they are, recorded or live",
        "A direct line to the founders — Shape Pairlum",
        "Export your data whenever you like"
      ]
    },
    {
      id: "book", name: "Pairlum Membership + Physical Pairlum Book", short: "Membership + Book", amount: null, period: "year",
      line: "Everything in Digital, plus your story in print.",
      features: [
        "Everything in Digital Membership",
        "A printed Pairlum Book of your year together",
        "The Book becomes available after 1 full year on this plan",
        "One Book per couple space"
      ]
    }
  ]
};
