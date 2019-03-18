// Require Third-party Dependencies
require("make-promises-safe");
require("dotenv").config();
const repos = require("repos");
const { yellow, red } = require("kleur");
const { get } = require("httpie");

// CONSTANTS
const token = process.env.GIT_TOKEN;

async function main() {
    console.time("gen_link");
    const orphans = new Set();
    const projectLink = Object.create(null);

    const fullRepositories = await repos("SlimIO", { token });
    const filteredRepositories = fullRepositories
        .filter((row) => row.archived === false)
        .map((row) => {
            projectLink[row.name] = Object.freeze({
                uses: new Set(), dependOn: new Set()
            });

            return {
                id: row.id,
                fullName: row.full_name,
                name: row.name,
                url: row.html_url,
                desc: row.description,
                // size: row.size,
                // license: row.license,
                defaultBranch: row.default_branch
            };
        });

    for (const repo of filteredRepositories) {
        console.log(`- Processing ${yellow(repo.fullName)}`);
        const packageURL = new URL(`https://api.github.com/repos/${repo.fullName}/contents/package.json`);

        try {
            const { data } = await get(packageURL, {
                headers: {
                    "User-Agent": "SlimIO",
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github.v3.raw"
                }
            });

            const pkg = JSON.parse(data);
            const slimioDep = Object.keys(pkg.dependencies || {}).filter((name) => name.startsWith("@slimio"));

            for (const dep of slimioDep) {
                projectLink[repo.name].uses.add(dep);
                if (Reflect.has(projectLink, dep)) {
                    projectLink[dep].dependOn.add(repo.name);
                }
                else {
                    orphans.add(dep);
                }
            }
        }
        catch (err) {
            console.log(red(`Failed to retrieve project: ${yellow(repo.fullName)}`));
        }
    }
    console.timeEnd("gen_link");

    console.log(JSON.stringify(projectLink, null, 2));
}
main().catch(console.error);
