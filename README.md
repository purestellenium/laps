# lol another personal site
a static personal site, written in HTML, CSS, and JavaScript - because it's a tradition at this point
i was gonna make it in svelte but turns out actually i don't care that much

# stack
- html
- css
- javascript
- bun

# dev setup
it's just an html file with a build step - it should work seamlessly when deployed / built to a hosting provider like vercel.

upon project initialization:
```
bun install
```

build with the following command:
```
node build.js
```

# how to use blog
just put .md files into the `posts` folder, and they'll be built into blog pages in the build step (`build.js`). look at an example blog post file to see how to format these files (with frontmatter). the naming scheme of these blogposts is `YYYY-MM-DD-slug.md`. images for these posts belong in the `posts/images` folder.

# ai declaration
a lot of the development of this project was ai-assisted using claude code, primarily opus and sonnet. the concept, design, and structure of the site were all by me - ai was primarily used to make writing tedious code (repetitive css rules and site structure) more efficient and consistent across the board.

# contributing
no it's my site, tf? but you're welcome to fork it for your own site i guess