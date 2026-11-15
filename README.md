# mindfulhound

I need a webapp, which will allow me to enter and save my daily expenses / purchases and allow me to run various analytics on the captured data. The data schema exists in my connected supabase db - project https://jaellgweggisthweiabv.supabase.co table p_dlyexp

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4047599c-ed92-43c8-801f-df89d8d354e6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Account-private ledgers

The app uses the existing `jaellgweggisthweiabv` Supabase project and `p_dlyexp`
table. Apply the [existing-project migration and deployment steps](docs/existing-supabase.md)
before deploying this version. Existing unowned entries are assigned to
`gopinathr.r@gmail.com`; other users see only their own expenses.

Use `bun install --frozen-lockfile`, `bun run test`, and `bun run dev` for the
lockfile-based development workflow.

## Portfolio

The Portfolio module adds private INR holdings, dated valuation history and
handover notes. Apply the [portfolio migration](docs/portfolio.md) in the existing
Supabase project before deploying this version. Personal financial rows are not included in the source repository. Portfolio
import/export are disabled in the current release.

Portfolio goal planning and sorting require the [goals upgrade migration](docs/portfolio-goals.md).
The current version disables portfolio import/export and reserves ₹10,00,000 before goal planning.
