# MADE Evo

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src/
│   ├── layouts/
│   │   └── Layout.astro
│   └── pages/
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).

# PII Sanitization of Data
This document addresses some of the sanitization needs for the different data blobs that are ingested. Theoretically, none of the PII data will ever be directly publicly accessible. However, we may add more individuals to help us on the site, and they should never have access to data containing PII unless they have explicit permission for the data blob with which they are directly interacting.

# How to Handle Data as a Requester
Data blobs brought into the repository are to be treated with strict permissions. If you do not have access to the data, you can request to have a sanitized version of it. Reach out to the executive director to find the respective committee to provide you with the sanitized data.

# How to Handle Data as a Data Manager
If you own the data, this next section is for you. The following will give you information on how to sanitize the existing data blobs within this repository.
1. eventbrite_event.csv
   1. No sanitization required
2. form_class.csv
   1. Columns B,C,D, and I need to be removed from the source CSV file.
3. form_museum_hardware_inventory.csv
   1. Column B needs to be removed from the source CSV file
4. google_user.csv
   1. All columns other than A, B, and C must be removed
5. square_product.csv
   1. No PII data here
