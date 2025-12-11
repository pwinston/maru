# AI Usage

I used ChatGPT during the planning phase and Claude Code during development.

While I only have access to GitHub Copilot at work, I've been experimenting a
lot with Claude Code on side-projects, for months now. I believe that style of
development is the future, especially for greenfield code and small codebases.
So I decided to use it heavily for this assignment. My flow generally is:

1. Use Claude Code to generate the next step quickly.
2. Iterate until functional if needed.
2. Examine the code closely and refactor by hand or with Claude Code.

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
