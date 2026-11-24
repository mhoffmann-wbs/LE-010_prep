# LE-010_prep

A free self-study web app for the **LPI Linux Essentials (010-200)** exam, written for people who have never used Linux.

- **Learn**: one lesson per exam objective, built around TuxPixel Studio, an invented indie game studio.
- **Check**: practice questions with explanations, a question bank, and a timed mock exam of 40 questions in 60 minutes.
- **Do**: a real Debian Linux running in your browser, auto-graded terminal exercises, simulators, drills and flashcards.

The app is a static site with no backend. Linux runs inside your browser through [v86](https://github.com/copy/v86), and progress stays in your browser.

Live site: https://mhoffmann-wbs.github.io/LE-010_prep/

## Development

```bash
npm install
npm run dev       # local dev server
npm test          # tests
npm run build     # production build
```

The terminal needs the Linux image, which is built with Docker (about 10 minutes on Apple silicon, where i386 is emulated):

```bash
pip install zstandard   # used by v86's image tools
npm run vm:build        # Debian 12 i386 guest → public/vm/
npm run vm:state        # boot it once in v86 and save the state the browser restores
npm run vm:smoke        # restore that state and check a few commands
```

The content follows the official [Linux Essentials objectives v2.0](https://www.lpi.org/our-certifications/exam-010-objectives/). Every question is written for this app. The free [LPI Learning Materials](https://learning.lpi.org/en/learning-materials/010-200/) are linked as further reading.

`scripts/vm/v86/` holds v86's image tools (BSD-2-Clause) and SeaBIOS/VGABIOS (LGPL-3.0), unchanged.

---

Not affiliated with or endorsed by the Linux Professional Institute. Linux Essentials is a trademark of the Linux Professional Institute. Linux® is the registered trademark of Linus Torvalds.
