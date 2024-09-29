// Store projects in localStorage
let projects = JSON.parse(localStorage.getItem('arStudioProjects')) || [];

const projectList = document.getElementById('projectList');
const newProjectBtn = document.getElementById('newProjectBtn');
const createProjectBtn = document.getElementById('createProjectBtn');
const currentProject = document.getElementById('currentProject');
const fileUpload = document.getElementById('fileUpload');
const uploadBtn = document.getElementById('uploadBtn');
const inspectorBtn = document.getElementById('inspectorBtn');
const saveBtn = document.getElementById('saveBtn');
const projectInterface = document.getElementById('projectInterface');
const aframeContainer = document.getElementById('aframeContainer');

function updateProjectList() {
    projectList.innerHTML = '';
    projects.forEach((project, index) => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.textContent = project.name;
        li.addEventListener('click', () => loadProject(index));
        projectList.appendChild(li);
    });
}

function createNewProject() {
    const projectName = document.getElementById('projectName').value;
    if (projectName) {
        const newProject = { name: projectName, scene: null };
        projects.push(newProject);
        localStorage.setItem('arStudioProjects', JSON.stringify(projects));
        updateProjectList();
        loadProject(projects.length - 1);
        const modal = bootstrap.Modal.getInstance(document.getElementById('newProjectModal'));
        modal.hide();
    }
}

function loadProject(index) {
    const project = projects[index];
    currentProject.innerHTML = `
        <h3>${project.name}</h3>
    `;
    fileUpload.style.display = 'block';
    uploadBtn.style.display = 'block';
}

function uploadModel() {
    const file = fileUpload.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            projectInterface.style.opacity = '0';
            setTimeout(() => {
                projectInterface.style.display = 'none';
                aframeContainer.style.display = 'block';
                
                const sceneEl = document.createElement('a-scene');
                sceneEl.innerHTML = `
                    <a-entity gltf-model="${e.target.result}"></a-entity>
                    <a-sky color="#ECECEC"></a-sky>
                `;
                document.getElementById('aframeScene').appendChild(sceneEl);
            }, 500);
        };
        reader.readAsDataURL(file);
    }
}

function openInspector() {
    const sceneEl = document.querySelector('a-scene');
    if (sceneEl) {
        sceneEl.components.inspector.openInspector();
    }
}

function saveProject() {
    const sceneEl = document.querySelector('a-scene');
    if (sceneEl) {
        const currentIndex = projects.findIndex(p => p.name === currentProject.querySelector('h3').textContent);
        projects[currentIndex].scene = sceneEl.innerHTML;
        localStorage.setItem('arStudioProjects', JSON.stringify(projects));
        alert('Project saved successfully!');
    }
}

// Event Listeners
createProjectBtn.addEventListener('click', createNewProject);
uploadBtn.addEventListener('click', () => fileUpload.click());
fileUpload.addEventListener('change', uploadModel);
inspectorBtn.addEventListener('click', openInspector);
saveBtn.addEventListener('click', saveProject);

// Initialize Bootstrap modal
const newProjectModal = new bootstrap.Modal(document.getElementById('newProjectModal'));

// Event listener for the "New Project" button
newProjectBtn.addEventListener('click', () => {
    document.getElementById('projectName').value = ''; // Clear the input field
    newProjectModal.show();
});

// Event listener for the modal's "Create Project" button
createProjectBtn.addEventListener('click', () => {
    createNewProject();
    newProjectModal.hide();
});

updateProjectList();