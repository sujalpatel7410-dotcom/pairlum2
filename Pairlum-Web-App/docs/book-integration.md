# Pairlum Book — native flipbook integration

The landing page's Pairlum Book section (`index.html`, `#book`) is ready to host the real interactive book viewer. It is **not** bundled yet: the source files could not be obtained from `glittering-medovik-504a47.netlify.app` (the site blocks automated downloads, and its viewer code and page images are not published anywhere else). As instructed, the external site is **not** iframed, and no imitation flipbook was built.

Until the viewer is added, the section shows three memory pages settling into a book as it scrolls in. That is a scroll transition, not a pretend viewer; the "Grab a corner. Turn a memory." hint stays hidden.

## Files needed from the existing flipbook project

Copy these from the flipbook's source (the Netlify project or its repo) into `pairlum2/book/`:

1. **The viewer script and styles**: the page-turn engine (drag/swipe, page bending, moving page shadows, rigid covers, keyboard arrows, fullscreen).
2. **Page images**: front cover, the 42 interior pages, back cover (44 total), in order.
3. **The paper sound(s)** used on page turns, if you want those exact recordings. Otherwise Pairlum's own soft page sound is used.

Leave out the gallery / page list, "The Reel Library" and "Personal Collection" branding, extraction notes and download records. Only the book itself is used.

## Hook-up (about 20 lines)

1. Wrap the viewer so it exposes one function:

   ```js
   window.PairlumBook = {
     mount(stageElement, { manifest, sound, onTurn, reducedMotion, quality }) { … }
   };
   ```
   - `sound()` returns true only when the visitor has turned Sound on in Pairlum Settings. Play paper sounds only then.
   - `onTurn()` is called on each page turn, so Pairlum can play its page sound.
   - `reducedMotion`: when true, turn pages without the bending animation.
   - `quality`: `'low'` turns off page shadows and bending on weaker phones.

2. In `index.html`, set the one config line:

   ```js
   var BOOK_VIEWER = { script: 'book/pairlum-book.js', css: 'book/pairlum-book.css', manifest: 'book/manifest.json' };
   ```

The page then removes the placeholder pages, mounts the viewer in the stage, shows the "Grab a corner. Turn a memory." hint and switches the cursor to the **Drag** grab indicator over the book.
