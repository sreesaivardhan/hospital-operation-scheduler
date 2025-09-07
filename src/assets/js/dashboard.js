/* ==============================
   Dashboard.js - Optimized
   ============================== */

/* ---------- DOCTORS ---------- */
let doctors = [];

function renderDoctors() {
  const container = document.getElementById("doctorsContainer");
  container.innerHTML = "";
  doctors.forEach((doc, index) => {
    container.innerHTML += `
      <div class="item-card">
        <div class="item-header">
          <div>
            <div class="item-title">${doc.name}</div>
            <div class="item-subtitle">${doc.specialization} | ${doc.status}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-sm btn-primary" onclick="editDoctor(${index})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteDoctor(${index})">Delete</button>
          </div>
        </div>
      </div>`;
  });
}

document.getElementById("doctorForm").addEventListener("submit", e => {
  e.preventDefault();
  const doctor = {
    name: doctorName.value,
    email: doctorEmail.value,
    phone: doctorPhone.value,
    specialization: doctorSpecialization.value,
    experience: doctorExperience.value,
    fee: doctorFee.value,
    status: doctorStatus.value,
    bio: doctorBio.value
  };
  if (doctorForm.dataset.editIndex !== undefined) {
    doctors[doctorForm.dataset.editIndex] = doctor;
    delete doctorForm.dataset.editIndex;
  } else {
    doctors.push(doctor);
  }
  renderDoctors();
  closeDoctorModal();
});

function editDoctor(index) {
  const doc = doctors[index];
  doctorName.value = doc.name;
  doctorEmail.value = doc.email;
  doctorPhone.value = doc.phone;
  doctorSpecialization.value = doc.specialization;
  doctorExperience.value = doc.experience;
  doctorFee.value = doc.fee;
  doctorStatus.value = doc.status;
  doctorBio.value = doc.bio;
  doctorForm.dataset.editIndex = index;
  openDoctorModal();
}

function deleteDoctor(index) {
  if (confirm("Delete this doctor?")) {
    doctors.splice(index, 1);
    renderDoctors();
  }
}

function exportDoctors() {
  console.log("Exporting doctors:", doctors);
}

/* ---------- PATIENTS ---------- */
let patients = [];

function renderPatients() {
  const container = document.getElementById("patientsContainer");
  container.innerHTML = "";
  patients.forEach((pat, index) => {
    container.innerHTML += `
      <div class="item-card">
        <div class="item-header">
          <div>
            <div class="item-title">${pat.name}, ${pat.age} yrs</div>
            <div class="item-subtitle">${pat.gender} | ${pat.blood}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-sm btn-primary" onclick="editPatient(${index})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deletePatient(${index})">Delete</button>
          </div>
        </div>
      </div>`;
  });
}

document.getElementById("patientForm").addEventListener("submit", e => {
  e.preventDefault();
  const patient = {
    name: patientName.value,
    age: patientAge.value,
    gender: patientGender.value,
    phone: patientPhone.value,
    email: patientEmail.value,
    blood: patientBloodGroup.value,
    emergency: emergencyContact.value,
    status: patientStatus.value,
    address: patientAddress.value,
    history: medicalHistory.value
  };
  if (patientForm.dataset.editIndex !== undefined) {
    patients[patientForm.dataset.editIndex] = patient;
    delete patientForm.dataset.editIndex;
  } else {
    patients.push(patient);
  }
  renderPatients();
  closePatientModal();
});

function editPatient(index) {
  const pat = patients[index];
  patientName.value = pat.name;
  patientAge.value = pat.age;
  patientGender.value = pat.gender;
  patientPhone.value = pat.phone;
  patientEmail.value = pat.email;
  patientBloodGroup.value = pat.blood;
  emergencyContact.value = pat.emergency;
  patientStatus.value = pat.status;
  patientAddress.value = pat.address;
  medicalHistory.value = pat.history;
  patientForm.dataset.editIndex = index;
  openPatientModal();
}

function deletePatient(index) {
  if (confirm("Delete this patient?")) {
    patients.splice(index, 1);
    renderPatients();
  }
}

function exportPatients() {
  console.log("Exporting patients:", patients);
}

/* ---------- OT ROOMS ---------- */
let otRooms = [];

function renderOTRooms() {
  const container = document.getElementById("otRoomsContainer");
  container.innerHTML = "";
  otRooms.forEach((room, index) => {
    container.innerHTML += `
      <div class="item-card">
        <div class="item-header">
          <div>
            <div class="item-title">Room: ${room.roomId}</div>
            <div class="item-subtitle">${room.type} | Capacity: ${room.capacity}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-sm btn-primary" onclick="editOTRoom(${index})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteOTRoom(${index})">Delete</button>
          </div>
        </div>
      </div>`;
  });
}

document.getElementById("otRoomForm").addEventListener("submit", e => {
  e.preventDefault();
  const room = {
    roomId: roomId.value,
    type: roomType.value,
    capacity: capacity.value
  };
  if (otRoomForm.dataset.editIndex !== undefined) {
    otRooms[otRoomForm.dataset.editIndex] = room;
    delete otRoomForm.dataset.editIndex;
  } else {
    otRooms.push(room);
  }
  renderOTRooms();
  closeOTRoomModal();
});

function editOTRoom(index) {
  const room = otRooms[index];
  roomId.value = room.roomId;
  roomType.value = room.type;
  capacity.value = room.capacity;
  otRoomForm.dataset.editIndex = index;
  openOTRoomModal();
}

function deleteOTRoom(index) {
  if (confirm("Delete this OT Room?")) {
    otRooms.splice(index, 1);
    renderOTRooms();
  }
}

/* ---------- OT SCHEDULE ---------- */
let schedules = [];

function renderSchedules() {
  const container = document.getElementById("otScheduleList");
  container.innerHTML = "";
  schedules.forEach((sch, index) => {
    container.innerHTML += `
      <div class="item-card">
        <div class="item-header">
          <div>
            <div class="item-title">OT ${sch.otRoom} | ${sch.date}</div>
            <div class="item-subtitle">Surgeon: ${sch.surgeon}</div>
          </div>
          <div class="item-actions">
            <button class="btn btn-sm btn-primary" onclick="editSchedule(${index})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteSchedule(${index})">Delete</button>
          </div>
        </div>
      </div>`;
  });
}

document.getElementById("otScheduleForm").addEventListener("submit", e => {
  e.preventDefault();
  const schedule = {
    date: surgeryDate.value,
    otRoom: otRoom.value,
    surgeon: surgeon.value,
    assistants: assistants.value,
    nurses: nurses.value,
    prePost: prePost.value,
    remarks: remarks.value,
    resources: resources.value
  };
  if (otScheduleForm.dataset.editIndex !== undefined) {
    schedules[otScheduleForm.dataset.editIndex] = schedule;
    delete otScheduleForm.dataset.editIndex;
  } else {
    schedules.push(schedule);
  }
  renderSchedules();
  closeOTScheduleModal();
});

function editSchedule(index) {
  const sch = schedules[index];
  surgeryDate.value = sch.date;
  otRoom.value = sch.otRoom;
  surgeon.value = sch.surgeon;
  assistants.value = sch.assistants;
  nurses.value = sch.nurses;
  prePost.value = sch.prePost;
  remarks.value = sch.remarks;
  resources.value = sch.resources;
  otScheduleForm.dataset.editIndex = index;
  openOTScheduleModal();
}

function deleteSchedule(index) {
  if (confirm("Delete this schedule?")) {
    schedules.splice(index, 1);
    renderSchedules();
  }
}

/* ---------- UTILITIES ---------- */
function toggleSidebar() {
  document.getElementById("dashboardNav").classList.toggle("open");
}

function showSection(sectionId) {
  document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active"));
  document.getElementById(`section-${sectionId}`).classList.add("active");
}
