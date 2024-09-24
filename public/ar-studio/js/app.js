// app.js

// IndexedDB variables
let db;
const dbName = 'ARStudioDB';
const dbVersion = 1;

// Open (or create) the database
const request = indexedDB.open(dbName, dbVersion);

request.onupgradeneeded = function (event) {
  db = event.target.result;
  const objectStore = db.createObjectStore('projects', { keyPath: 'id' });
  console.log('IndexedDB setup complete.');
};

request.onsuccess = function (event) {
  db = event.target.result;
  console.log('IndexedDB opened successfully.');
  // Load projects when the database is ready
  loadProjects();
};

request.onerror = function (event) {
  console.error('IndexedDB error:', event.target.errorCode);
};

// Function to load projects from IndexedDB
function loadProjects() {
  const transaction = db.transaction(['projects'], 'readonly');
  const objectStore = transaction.objectStore('projects');
  const request = objectStore.getAll();

  request.onsuccess = function (event) {
    const projects = event.target.result;
    projects.forEach((project) => {
      addProjectToUI(project);
    });
  };

  request.onerror = function (event) {
    console.error('Error loading projects:', event.target.errorCode);
  };
}

// Function to add a project card to the UI
function addProjectToUI(project) {
  const projectList = document.getElementById('project-list');
  const col = document.createElement('div');
  col.className = 'col-md-4';

  col.innerHTML = `
    <div class="card mb-4">
      <div class="card-body">
        <h5 class="card-title">${project.name}</h5>
        <button class="btn btn-primary" onclick="openProject('${project.id}')">Open</button>
      </div>
    </div>
  `;
  projectList.appendChild(col);
}

// Function to open a project in the editor
function openProject(projectId) {
  window.location.href = `/ar-studio/editor.html?id=${projectId}`;
}

// app.js

// ... IndexedDB setup code ...

// Event listener for the new project form submission
document.getElementById('new-project-form').addEventListener('submit', function (e) {
    e.preventDefault();
  
    const projectName = document.getElementById('project-name').value;
    const modelUpload = document.getElementById('model-upload').files[0];
  
    if (modelUpload) {
      const reader = new FileReader();
  
      // Determine the file extension
      const modelName = modelUpload.name;
      const modelExtension = modelName.split('.').pop().toLowerCase();
  
      reader.onload = function (e) {
        const modelData = e.target.result;
        // Save project data (name and model) to IndexedDB
        saveNewProject(projectName, modelData, modelName);
      };
  
      if (modelExtension === 'glb') {
        // Read as ArrayBuffer for binary files
        reader.readAsArrayBuffer(modelUpload);
      } else {
        // Read as Data URL for text-based files
        reader.readAsDataURL(modelUpload);
      }
    } else {
      alert('Please select a 3D model to upload.');
    }
  });
  
  // Function to save a new project to IndexedDB
  function saveNewProject(name, modelData, modelName) {
    const projectId = 'project-' + Date.now();
  
    const project = {
      id: projectId,
      name: name,
      modelData: modelData,
      modelName: modelName,
      sceneData: null,
    };
  
    const transaction = db.transaction(['projects'], 'readwrite');
    const objectStore = transaction.objectStore('projects');
    const request = objectStore.add(project);
  
    request.onsuccess = function () {
      // Update the project list UI
      addProjectToUI(project);
      // Close the modal
      $('#newProjectModal').modal('hide');
      // Reset the form
      document.getElementById('new-project-form').reset();
      console.log('Project saved successfully.');
    };
  
    request.onerror = function () {
      console.error('Error saving project:', request.error);
    };
  }
  