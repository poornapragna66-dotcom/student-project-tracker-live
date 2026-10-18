const form = document.getElementById("project-form");
const nameInput = document.getElementById("name");
const statusInput = document.getElementById("status");
const projectList = document.getElementById("project-list");
const emptyState = document.getElementById("empty-state");
const saveButton = document.getElementById("save-button");
const cancelButton = document.getElementById("cancel-button");
const message = document.getElementById("message");

let projects = [];
let editingId = null;
let busy = false;
let loadSucceeded = false;

const validStatuses = ["Planned", "In Progress", "Completed"];

// Display a message to the user.
function showMessage(text) {
    message.textContent = text;
}

// Read an API error message when the server provides one.
async function getErrorMessage(response) {
    try {
        const data = await response.json();

        if (typeof data.error === "string" && data.error.trim()) {
            return data.error;
        }
    } catch (error) {
        // The response did not contain readable JSON.
    }

    return `Request failed (${response.status} ${response.statusText}).`;
}

// Send a request and give network failures a readable message.
async function apiRequest(url, options = {}) {
    let response;

    try {
        response = await fetch(url, options);
    } catch (error) {
        throw new Error(
            "Could not connect to the server. Check that it is running and try again."
        );
    }

    if (!response.ok) {
        throw new Error(await getErrorMessage(response));
    }

    return response;
}

// Reset the form and leave edit mode.
function resetForm() {
    form.reset();
    editingId = null;
    saveButton.textContent = "Save Project";
    cancelButton.hidden = true;
}

// Disable mutation controls while a request is in progress.
function setBusy(value) {
    busy = value;
    saveButton.disabled = value;
    cancelButton.disabled = value;

    projectList.querySelectorAll("button").forEach(function (button) {
        button.disabled = value;
    });
}

// Display the projects returned by the API.
function renderProjects() {
    projectList.replaceChildren();

    projects.forEach(function (project) {
        const li = document.createElement("li");

        const name = document.createElement("strong");
        name.textContent = project.name;

        const status = document.createElement("span");
        status.textContent = " - " + project.status;

        const actions = document.createElement("div");
        actions.className = "card-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.disabled = busy;

        editButton.addEventListener("click", function () {
            if (busy) return;

            editingId = project.id;
            nameInput.value = project.name;
            statusInput.value = project.status;

            saveButton.textContent = "Save changes";
            cancelButton.hidden = false;

            showMessage("Editing project: " + project.name);
            nameInput.focus();
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.disabled = busy;

        deleteButton.addEventListener("click", async function () {
            if (busy) return;

            const confirmed = window.confirm(
                'Are you sure you want to delete "' +
                project.name +
                '"?'
            );

            if (!confirmed) {
                return;
            }

            setBusy(true);
            showMessage("Deleting project...");

            try {
                await apiRequest(
                    `/api/projects/${encodeURIComponent(project.id)}`,
                    { method: "DELETE" }
                );

                if (editingId === project.id) {
                    resetForm();
                }

                await loadProjects();
                showMessage("Project deleted successfully.");
            } catch (error) {
                showMessage("Could not delete project: " + error.message);
            } finally {
                setBusy(false);
                renderProjects();
            }
        });

        actions.appendChild(editButton);
        actions.appendChild(deleteButton);

        li.appendChild(name);
        li.appendChild(status);
        li.appendChild(actions);

        projectList.appendChild(li);
    });

    // Do not show the empty state if loading failed.
    emptyState.hidden = !loadSucceeded || projects.length > 0;
}

// Load the current collection from the Express API.
async function loadProjects() {
    showMessage("Loading projects...");

    try {
        const response = await apiRequest("/api/projects");
        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("The server returned an invalid project list.");
        }

        projects = data;
        loadSucceeded = true;
        renderProjects();

        showMessage(
            projects.length === 0
                ? "No projects in the database yet."
                : "Projects loaded successfully."
        );

        return true;
    } catch (error) {
        loadSucceeded = false;
        renderProjects();
        showMessage("Could not load projects: " + error.message);
        return false;
    }
}

// Create a project or update the project being edited.
form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (busy) return;

    const projectName = nameInput.value.trim();
    const projectStatus = statusInput.value;

    if (projectName === "") {
        showMessage("Please enter a project name.");
        nameInput.focus();
        return;
    }

    if (!validStatuses.includes(projectStatus)) {
        showMessage("Please select a valid project status.");
        return;
    }

    const isEditing = editingId !== null;
    const url = isEditing
        ? `/api/projects/${encodeURIComponent(editingId)}`
        : "/api/projects";

    const options = {
        method: isEditing ? "PUT" : "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: projectName,
            status: projectStatus
        })
    };

    setBusy(true);
    showMessage(isEditing ? "Saving changes..." : "Adding project...");

    try {
        await apiRequest(url, options);

        // Only reset the form after the server confirms success.
        resetForm();

        const refreshed = await loadProjects();

        if (refreshed) {
            showMessage(
                isEditing
                    ? "Project updated successfully."
                    : "Project added successfully."
            );
        } else {
            showMessage(
                "The server saved your change, but the project list could not be refreshed. Try reloading the list."
            );
        }

        nameInput.focus();
    } catch (error) {
        showMessage("Could not save project: " + error.message);
    } finally {
        setBusy(false);
        renderProjects();
    }
});

// Cancel editing without sending an API request.
cancelButton.addEventListener("click", function () {
    if (busy) return;

    resetForm();
    showMessage("Editing cancelled. No changes were saved.");
    nameInput.focus();
});

// Load the database-backed collection when the page opens.
loadProjects();