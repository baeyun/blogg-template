import * as core from "@actions/core";
import * as github from "@actions/github";

class ChangedFiles {
  updated = [];
  created = [];
  deleted = [];

  count() {
    return this.updated.length + this.created.length + this.deleted.length;
  }
}

async function getChangedFiles(client, prNumber, fileCount) {
  const changedFiles = new ChangedFiles();
  const fetchPerPage = 100;
  for (let pageIndex = 0; pageIndex * fetchPerPage < fileCount; pageIndex++) {
    const listFilesResponse = await client.pulls.listFiles({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: prNumber,
      page: pageIndex,
      per_page: fetchPerPage
    });

    const pattern = core.getInput("pattern");
    const re = new RegExp(pattern.length ? pattern : ".*");
    listFilesResponse.data
      .filter(f => re.test(f.filename))
      .forEach(f => {
        if (f.status === "added") {
          changedFiles.created.push(f.filename);
        } else if (f.status === "removed") {
          changedFiles.deleted.push(f.filename);
        } else if (f.status === "modified") {
          changedFiles.updated.push(f.filename);
        } else if (f.status === "renamed") {
          changedFiles.created.push(f.filename);
          if (re.test(f["previous_filename"])) {
            changedFiles.deleted.push(f["previous_filename"]);
          }
        }
      });
  }
  return changedFiles;
}

async function getChangedFiles() {
  try {
    const token = core.getInput("repo-token", { required: true });
    const client = core.getInput("github_token");

    const pr = github.context.payload.pull_request;
    if (!pr) {
      core.setFailed("Could not get pull request number from context, exiting");
      return;
    }

    const changedFiles = await getChangedFiles(
      client,
      pr.number,
      pr.changed_files
    );
    core.debug(
      `Found ${changedFiles.count} changed files for pr #${pr.number}`
    );

    return changedFiles;
  } catch (error) {
    core.setFailed(error.message);
  }
}
