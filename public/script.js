// var SERVER_ROOT = "https://material-troll.herokuapp.com";
var SERVER_ROOT = "http://localhost:8080";

var app = new Vue({
    el: "#app",
    data: {
        // fields for new material form
        mat_name: "",
        mat_resolution: "",
        mat_tags: "",
        mat_workflow: "",
        mat_thumbnail: "Upload a thumbnail",
        files: {},
        createModalVisible: false,

        materials: [],
        search: "",
        errs: {},
        tag_demo: ["Rock", "Ground", "Metal", "Glass", "Brick"],
        checked_tags: [],

        // authentication fields
        isLoggedIn: false,
        showLogin: true,
        loginUser: "",
        loginPassword: "",
        registerUser: "",
        registerPassword: "",
        loginMessage: "",
        
        // fields for material detail view
        detailsModalVisible: false,
        detailsId: null,
        selectedMat: null,

        // fields for material edit view
        editMode: false,
        edit_name: "",
        edit_resolution: "",
        edit_tags: "",
        edit_workflow: "",
    },

    computed: {
        filteredList: function() {
            return this.materials.filter(mat => {
                return mat.name.toLowerCase().includes(this.search.toLowerCase());
            })
        },

        formIsValid: function() {
            return Object.keys(this.errs).length == 0;
        },

        showMetallic: function() {
            return (this.mat_workflow === "metallic") ? "block" : "none";
        },

        showSpecular: function() {
            return (this.mat_workflow === "specular") ? "block" : "none";
        },

        editBtn: function() {
            return (this.editMode) ? "CANCEL" : "EDIT";
        }
    },

    methods: {
        debug: function() {
            console.log(`Errors: ${JSON.stringify(this.errs)}`);
        },
        
        resetVue: function(doFetch) {
            this.mat_name = "";
            this.mat_resolution = "";
            this.mat_tags = "";
            this.mat_workflow = "";
            this.mat_thumbnail = "Upload a thumbnail";

            this.edit_name = "";
            this.edit_resolution = "";
            this.edit_tags = "";
            this.edit_workflow = "";

            this.files = {};
            this.errs = {};

            this.editMode = false;
            this.createModalVisible = false;
            this.detailsModalVisible = false;
            this.detailsId = null;
            this.selectedMat = null;
            this.search = "";
            if (doFetch) this.fetchMaterials();
        },

        toggleCreateModal: function () {
            this.createModalVisible = !this.createModalVisible;
        },

        toggleDetailsModal: function(event) {
            if (!this.detailsModalVisible) {
                this.detailsId = event.currentTarget.dataset.id;
                this.fetchMaterial(this.detailsId);
            }
            this.detailsModalVisible = !this.detailsModalVisible;
            if (!this.detailsModalVisible) {
                // this.selectedMat = null;
                // this.editMode = false;
                this.resetVue(false);
            }
        },

        onFileSelect: function(event) {
            this.files[event.currentTarget.name] = event.currentTarget.files[0];
            if (event.currentTarget.name == "thumbnail") {
                this.mat_thumbnail = event.currentTarget.files[0].name;
            }
        },

        toggleEditMode: function() {
            this.editMode = !this.editMode;
            if (this.editMode) {
                this.edit_name = this.selectedMat.name;
                this.edit_resolution = this.selectedMat.resolution;
                this.edit_tags = this.selectedMat.tags;
                this.edit_workflow = this.selectedMat.workflow;
            } else {
                this.edit_name = "";
                this.edit_resolution = "";
                this.edit_tags = "";
                this.edit_workflow = "";
                this.editMode = false;
            }
        },

        fetchMaterials: function () {
            fetch(`${SERVER_ROOT}/materials`).then((res) => {
                console.log(`fetched data: ${res}`);
                res.json().then((data) => {
                    // this.materials = data;
                    this.materials = data.sort((a, b) => {
                        if (a.name.toLowerCase() > b.name.toLowerCase()) {
                            return 1;
                        } else {
                            return -1;
                        }
                    });
                }).catch((err) => {
                    console.error(`Error parsing materials: ${err}`);
                })
            }).catch((err) => {
                console.error(`Error fetching materials: ${err}`);
            })
        },

        fetchMaterial: function(id) {
            fetch(`${SERVER_ROOT}/materials/${id}`, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }).then((res) => {
                res.json().then((data) => {
                    this.selectedMat = data;
                })
            })
        },

        addMaterial: function() {
            if (!this.validateForm("add")) return;

            let formData = new FormData();
            formData.append("name", this.mat_name);
            formData.append("resolution", this.mat_resolution);
            formData.append("tags", this.mat_tags);
            formData.append("workflow", this.mat_workflow);

            for (let file in this.files) {
                formData.append(file, this.files[file]);
            }

            fetch(`${SERVER_ROOT}/materials`, {
                method: "POST",
                body: formData,
            }).then((res) => {
                this.resetVue(true);
            })
        },

        updateMaterial: function() {
            if (!this.validateForm("edit")) return;

            let formData = new FormData();
            formData.append("name", this.edit_name);
            formData.append("resolution", this.edit_resolution);
            formData.append("tags", this.edit_tags);
            formData.append("workflow", this.edit_workflow);

            for (let file in this.files) {
                formData.append(file, this.files[file]);
            }

            fetch(`${SERVER_ROOT}/materials/${this.detailsId}`, {
                method: "PUT",
                body: formData,
            }).then((res) => {
                this.resetVue(true);
            });
        },

        deleteMaterial: function() {
            if (confirm("Are you sure you want to delete this material?")) {
                fetch(`${SERVER_ROOT}/materials/${this.detailsId}`, {
                    method: "DELETE",
                }).then((res) => {
                    this.resetVue(true);
                })
            }
        },

        validateForm: function(whichForm) {
            this.errs = {};

            if (Object.keys(this.files).length > 0 && this.files.thumbnail == null) {
                this.errs.maps = "A thumbnail is required if textures have been add or changed.";
            }

            if (whichForm === "add") {
                if (this.mat_name === "") {
                    this.errs.name = "* Name is required";
                }
                if (this.mat_resolution === "") {
                    this.errs.resolution = "* Resolution is required";
                }
                if (this.mat_workflow === "") {
                    this.errs.workflow = "* Workflow is required";
                }
            } else if (whichForm === "edit") {
                if (this.edit_name === "") {
                    this.errs.name = "* Name is required";
                }
                if (this.edit_resolution === "") {
                    this.errs.resolution = "* Resolution is required";
                }
                if (this.edit_workflow === "") {
                    this.errs.workflow = "* Workflow is required";
                }
            } else if (whichForm == "login") {
                if (this.loginUser === "") {
                    this.errs.username = "* Username is required";
                }
                if (this.loginPassword === "") {
                    this.errs.password = "* Password is required";
                }
            } else if (whichForm == "register") {
                if (this.registerUser === "") {
                    this.errs.username = "* Username is required";
                }
                if (this.registerPassword === "") {
                    this.errs.password = "* Password is required";
                }
            } else {
                console.error("Invalid form to validate");
            }

            return this.formIsValid;
        },

        catchNullThumbnail: function(mapsObj) {
            try {
                return mapsObj.thumbnail;
            } catch (e) {
                return "./logo.png";
            }
        },

        login: function() {
            if (!this.validateForm("login")) return;
            var data = `username=${encodeURIComponent(this.loginUser)}&password=${encodeURIComponent(this.loginPassword)}`;
            fetch(`${SERVER_ROOT}/session`, {
                method: "POST",
                credentials: "include",
                body: data,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }).then(res => {
                if (res.status === 201) {
                    this.isLoggedIn = true;
                    this.authorize();
                } else {
                    this.errs.login = "Invalid username or password";
                    this.loginPassword = "";
                }
            })
        },

        toggleLogin: function() {
            this.showLogin = !this.showLogin;
            this.errs = {};
        },

        register: function() {
            if (!this.validateForm("register")) return;
            var data = `username=${encodeURIComponent(this.registerUser)}&password=${encodeURIComponent(this.registerPassword)}`;
            fetch(`${SERVER_ROOT}/users`, {
                method: "POST",
                credentials: "include",
                body: data,
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }).then(res => {
                if (res.status === 201) {
                    // user registered. now must log in
                    this.loginMessage = "Registration successful. Please log in.";
                } else {
                    this.errs.uniqueUser = "* Username is already taken";
                    this.registerPassword = "";
                }
            })
        },

        authorize: function() {
            fetch(`${SERVER_ROOT}/session`, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }).then((res) => {
                if (res.status === 200) {
                    this.fetchMaterials();
                    this.loginMessage = "";
                    this.isLoggedIn = true;
                } else {
                    this.isLoggedIn = false;
                }
            })
        }
    },

    created: function() {
        this.authorize();
    }
})
