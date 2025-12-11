# AI Usage

I used ChatGPT during the planning phase and Claude Code during development.

I've been experimenting with Claude Code for months so I knew it would be
the right tool for this task. I've fallen into many of the pitfalls while
using Claude Code (and AI in general) so I have a pretty good flow worked
out:

1. Use Claude Code to generate the next step quickly.
2. Iterate until functional, if needed.
3. Examine the code closely and refactor by hand or with Claude Code.

Never let the code "get away from you". At the same time don't cleanup
code if you aren't going to keep it.

For this project I'm using branches like this:

1. `dev` is rapid iteration with Claude Code.
2. PRs into `main` only when well-understood and cleaned up.

# Planning

I created README.md and wrote my version of the spec/requirements. I used
ChatGPT to discuss which libraries to use and what the general UI should look
like. I added all decisions to the README.

# PRs

PR #1 - Split Screen: 3D viewport on left, 2d sketch view on right  
![](images/01.jpg)

PR #2 - Three hard-coded planes with picking/selection  
![](images/02.jpg)

PR #3 - Simple sketch editing  
![](images/03.jpg)

PR #4 - Ability to Add and Delete vertexes  
![](images/04.jpg)
