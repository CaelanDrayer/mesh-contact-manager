document.addEventListener("DOMContentLoaded", function () {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  var contacts = [];
  var markers = {};          // index -> L.marker
  var originalFilename = "";
  var selectedIndex = null;  // index of the contact shown in detail panel
  var centerIndex = null;    // index of the contact used as radius-filter center
  var radiusCircle = null;   // L.circle drawn around center

  var csrfToken = "";
  fetch("/api/csrf-token")
    .then(function(res) { return res.json(); })
    .then(function(data) { csrfToken = data.csrf_token; });

  // ---------------------------------------------------------------------------
  // Map Initialization
  // ---------------------------------------------------------------------------
  var map = L.map("map").setView([48.5, -122.5], 8);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(map);

  // ---------------------------------------------------------------------------
  // DOM References
  // ---------------------------------------------------------------------------
  var dropZone        = document.getElementById("drop-zone");
  var fileInput       = document.getElementById("file-input");
  var fileInfo        = document.getElementById("file-info");
  var filtersSection  = document.getElementById("filters-section");
  var actionsSection  = document.getElementById("actions-section");
  var statsBar        = document.getElementById("stats-bar");

  // Filters
  var filterRepeater  = document.getElementById("filter-repeater");
  var filterClient    = document.getElementById("filter-client");
  var filterRoom      = document.getElementById("filter-room");
  var radiusKm        = document.getElementById("radius-km");
  var radiusCenterName = document.getElementById("radius-center-name");
  var clearCenterBtn  = document.getElementById("clear-center-btn");
  var lastseenDays    = document.getElementById("lastseen-days");
  var flagsSelect     = document.getElementById("flags-select");
  var unknownRemove   = document.getElementById("unknown-remove");
  var unknownKeep     = document.getElementById("unknown-keep");
  var alwaysKeepOptions = document.getElementById("always-keep-options");

  // Actions
  var saveBtn         = document.getElementById("save-btn");
  var exportBtn       = document.getElementById("export-btn");

  // Modal
  var saveModal       = document.getElementById("save-modal");
  var saveFilename    = document.getElementById("save-filename");
  var modalSaveBtn    = document.getElementById("modal-save-btn");
  var modalCancelBtn  = document.getElementById("modal-cancel-btn");

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  var TYPE_NAMES = { 1: "Client", 2: "Repeater", 3: "Room" };
  var TYPE_ICON_NAMES = { 1: "client", 2: "repeater", 3: "room" };

  function hasKnownLocation(contact) {
    var lat = parseFloat(contact.latitude);
    var lon = parseFloat(contact.longitude);
    if (isNaN(lat) || isNaN(lon)) return false;
    if (lat === 0 && lon === 0) return false;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
    return true;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function makeIcon(type, color) {
    var prefix = TYPE_ICON_NAMES[type] || "client";
    return L.icon({
      iconUrl: "/static/icons/" + prefix + "-" + color + ".svg",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
      shadowUrl: "",
      shadowSize: [0, 0]
    });
  }

  function iconColorForContact(index) {
    if (index === centerIndex) return "blue";
    return contacts[index].kept ? "green" : "red";
  }

  function daysSince(epochSeconds) {
    if (!epochSeconds) return null;
    var diff = (Date.now() / 1000) - epochSeconds;
    return Math.floor(diff / 86400);
  }

  // ---------------------------------------------------------------------------
  // Drag & Drop / File Upload
  // ---------------------------------------------------------------------------

  // Prevent browser default file-open behavior on the whole document
  document.addEventListener("dragover", function (e) { e.preventDefault(); });
  document.addEventListener("drop", function (e) { e.preventDefault(); });

  dropZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", function () {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
      uploadFile(e.dataTransfer.files[0]);
    }
  });

  dropZone.addEventListener("click", function () {
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files.length) {
      uploadFile(fileInput.files[0]);
    }
  });

  function uploadFile(file) {
    var formData = new FormData();
    formData.append("file", file);

    fetch("/api/upload", { method: "POST", body: formData, headers: { "X-CSRF-Token": csrfToken } })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          fileInfo.textContent = "Error: " + data.error;
          return;
        }

        originalFilename = data.filename;
        fileInfo.textContent = "Loaded " + data.total + " contacts from " + data.filename;

        // Initialize contact state
        contacts = data.contacts.map(function (c) {
          c.kept = true;
          c.manualOverride = false;
          return c;
        });

        filtersSection.hidden = false;
        actionsSection.hidden = false;
        buildAlwaysKeepOptions();
        // Short delay to ensure map container is properly sized before rendering
        setTimeout(function () {
          map.invalidateSize();
          renderMarkers();
          applyFilters();
        }, 100);
      })
      .catch(function (err) {
        fileInfo.textContent = "Upload failed: " + err.message;
      });
  }

  // ---------------------------------------------------------------------------
  // Always Keep by Flag
  // ---------------------------------------------------------------------------
  function buildAlwaysKeepOptions() {
    alwaysKeepOptions.innerHTML = "";
    // Find all unique flag values in the loaded contacts
    var flagSet = {};
    contacts.forEach(function (c) {
      var f = String(c.flags);
      if (!flagSet[f]) flagSet[f] = 0;
      flagSet[f]++;
    });
    var flagValues = Object.keys(flagSet).sort(function (a, b) {
      return parseInt(a) - parseInt(b);
    });
    if (flagValues.length === 0) {
      alwaysKeepOptions.innerHTML = "<small style='color:#666'>No data loaded</small>";
      return;
    }
    flagValues.forEach(function (fVal) {
      var label = document.createElement("label");
      label.className = "checkbox-label";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "always-keep-flag";
      cb.value = fVal;
      cb.addEventListener("change", applyFilters);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(
        " Flag " + fVal + " (" + flagSet[fVal] + " contacts)"
      ));
      alwaysKeepOptions.appendChild(label);
    });
  }

  function getAlwaysKeepFlags() {
    var flags = [];
    var checkboxes = alwaysKeepOptions.querySelectorAll(".always-keep-flag:checked");
    checkboxes.forEach(function (cb) {
      flags.push(cb.value);
    });
    return flags;
  }

  // ---------------------------------------------------------------------------
  // Marker Rendering
  // ---------------------------------------------------------------------------
  function renderMarkers() {
    // Clear existing markers
    Object.keys(markers).forEach(function (key) {
      map.removeLayer(markers[key]);
    });
    markers = {};

    var boundsPoints = [];

    contacts.forEach(function (contact, index) {
      if (!hasKnownLocation(contact)) return;

      var lat = parseFloat(contact.latitude);
      var lon = parseFloat(contact.longitude);
      var color = iconColorForContact(index);
      var icon = makeIcon(contact.type, color);

      var marker = L.marker([lat, lon], { icon: icon, interactive: true }).addTo(map);
      marker.on("click", function (e) {
        L.DomEvent.stopPropagation(e);
        onMarkerClick(index);
      });
      var name = (contact.custom_name || contact.name) || "(unknown)";
      marker.bindTooltip(escapeHtml(name), { direction: "top", offset: [0, -41] });
      markers[index] = marker;
      boundsPoints.push([lat, lon]);
    });

    // Fit bounds to only the loaded data points
    if (boundsPoints.length > 0) {
      map.invalidateSize();  // Ensure map knows its container size
      map.fitBounds(boundsPoints, { padding: [40, 40], maxZoom: 14 });
    }
  }

  function updateMarkerIcon(index) {
    if (!markers[index]) return;
    var contact = contacts[index];
    var color = iconColorForContact(index);
    markers[index].setIcon(makeIcon(contact.type, color));
  }

  // ---------------------------------------------------------------------------
  // Marker Click
  // ---------------------------------------------------------------------------
  function buildPopupContent(contact, index) {
    var name = escapeHtml((contact.custom_name || contact.name) || "(unknown)");
    var typeName = escapeHtml(TYPE_NAMES[contact.type] || ("Type " + contact.type));
    var days = daysSince(contact.last_advert);
    var lastSeen = escapeHtml(days !== null ? days + " days ago" : "Unknown");
    var loc = escapeHtml(hasKnownLocation(contact)
      ? parseFloat(contact.latitude).toFixed(4) + ", " + parseFloat(contact.longitude).toFixed(4)
      : "Unknown");
    var keyFull = escapeHtml(contact.public_key || "N/A");
    var statusColor = contact.kept ? "#22c55e" : "#ef4444";
    var statusText = contact.kept ? "Keeping" : "Removing";
    var btnClass = contact.kept ? "popup-btn-remove" : "popup-btn-keep";
    var btnText = contact.kept ? "Mark for Removal" : "Mark to Keep";

    return "<div class='popup-info'>" +
      "<div class='popup-header'>" +
        "<strong>" + name + "</strong>" +
        "<span class='popup-status' style='color:" + statusColor + "'>" + statusText + "</span>" +
      "</div>" +
      "<table class='popup-table'>" +
        "<tr><td class='popup-label'>Type</td><td>" + typeName + "</td></tr>" +
        "<tr><td class='popup-label'>Flags</td><td>" + escapeHtml(contact.flags) + "</td></tr>" +
        "<tr><td class='popup-label'>Key</td><td class='popup-key'>" + keyFull + "</td></tr>" +
        "<tr><td class='popup-label'>Location</td><td>" + loc + "</td></tr>" +
        "<tr><td class='popup-label'>Last Seen</td><td>" + lastSeen + "</td></tr>" +
      "</table>" +
      "<button class='popup-toggle " + btnClass + "' onclick='window._meshcoreToggle(" + index + ")'>" + btnText + "</button>" +
      "</div>";
  }

  // Global toggle function called from popup button
  window._meshcoreToggle = function (index) {
    var contact = contacts[index];
    contact.kept = !contact.kept;
    contact.manualOverride = true;
    updateMarkerIcon(index);
    updateStats();
    // Refresh the popup content
    if (markers[index]) {
      markers[index].unbindPopup();
      markers[index].bindPopup(buildPopupContent(contact, index), {
        maxWidth: 280,
        className: "meshcore-popup"
      }).openPopup();
    }
  };

  function onMarkerClick(index) {
    selectedIndex = index;
    var contact = contacts[index];

    // Show popup on map at marker location
    if (markers[index]) {
      markers[index].unbindPopup();
      markers[index].bindPopup(buildPopupContent(contact, index), {
        maxWidth: 280,
        className: "meshcore-popup"
      }).openPopup();
    }

    // Always set clicked contact as the radius center
    setCenterContact(index);
  }

  // ---------------------------------------------------------------------------
  // Radius Center
  // ---------------------------------------------------------------------------
  var centerLatLon = null; // [lat, lon] for arbitrary map-click center

  function drawRadiusCircle(lat, lon) {
    if (radiusCircle) {
      map.removeLayer(radiusCircle);
      radiusCircle = null;
    }
    var rKm = parseFloat(radiusKm.value);
    if (radiusKm.value === "" || isNaN(rKm) || rKm <= 0) return;

    radiusCircle = L.circle([lat, lon], {
      radius: rKm * 1000,
      color: "#3388ff",
      fillOpacity: 0.1,
      weight: 2
    }).addTo(map);
  }

  function setCenterContact(index) {
    centerIndex = index;
    centerLatLon = null;
    var contact = contacts[index];
    radiusCenterName.textContent = (contact.custom_name || contact.name) || "(unknown)";

    var lat = parseFloat(contact.latitude);
    var lon = parseFloat(contact.longitude);
    drawRadiusCircle(lat, lon);
    updateMarkerIcon(index);
    applyFilters();
  }

  function setCenterMapLocation(lat, lon) {
    centerIndex = null;
    centerLatLon = [lat, lon];
    radiusCenterName.textContent = "Map point: " + lat.toFixed(4) + ", " + lon.toFixed(4);

    drawRadiusCircle(lat, lon);
    applyFilters();
  }

  // Click on the map (not on a marker) to set radius center
  map.on("click", function (e) {
    if (contacts.length === 0) return;
    setCenterMapLocation(e.latlng.lat, e.latlng.lng);
  });

  clearCenterBtn.addEventListener("click", function () {
    centerIndex = null;
    centerLatLon = null;
    radiusCenterName.textContent = "Click a contact or map to set center";
    if (radiusCircle) {
      map.removeLayer(radiusCircle);
      radiusCircle = null;
    }
    applyFilters();
  });

  // ---------------------------------------------------------------------------
  // Filter Logic
  // ---------------------------------------------------------------------------
  function applyFilters() {
    var now = Date.now() / 1000;

    var showRepeater = filterRepeater.checked;
    var showClient = filterClient.checked;
    var showRoom = filterRoom.checked;

    var rVal = radiusKm.value !== "" ? parseFloat(radiusKm.value) : null;
    var lsDays = lastseenDays.value !== "" ? parseFloat(lastseenDays.value) : null;
    var flagsVal = flagsSelect.value; // "" means all
    var removeUnknown = unknownRemove.checked;
    var alwaysKeepFlags = getAlwaysKeepFlags();

    contacts.forEach(function (contact, index) {
      if (contact.manualOverride) {
        // Use the manually set kept state
        updateMarkerIcon(index);
        return;
      }

      // "Always Keep" by flag — overrides all other filters
      if (alwaysKeepFlags.length > 0 && alwaysKeepFlags.indexOf(String(contact.flags)) !== -1) {
        contact.kept = true;
        updateMarkerIcon(index);
        return;
      }

      var remove = false;

      // Type filter
      if (contact.type === 2 && !showRepeater) remove = true;
      if (contact.type === 1 && !showClient) remove = true;
      if (contact.type === 3 && !showRoom) remove = true;

      // Radius filter (supports both contact-based and map-click center)
      if (!remove && rVal !== null && hasKnownLocation(contact)) {
        var cLat = null, cLon = null;
        if (centerIndex !== null) {
          cLat = parseFloat(contacts[centerIndex].latitude);
          cLon = parseFloat(contacts[centerIndex].longitude);
        } else if (centerLatLon) {
          cLat = centerLatLon[0];
          cLon = centerLatLon[1];
        }
        if (cLat !== null && cLon !== null) {
          var dist = haversineKm(parseFloat(contact.latitude), parseFloat(contact.longitude), cLat, cLon);
          if (dist > rVal) remove = true;
        }
      }

      // Last seen filter
      if (!remove && lsDays !== null && contact.last_advert) {
        var threshold = lsDays * 86400;
        if ((now - contact.last_advert) > threshold) remove = true;
      }

      // Flags filter
      if (!remove && flagsVal !== "") {
        if (String(contact.flags) !== flagsVal) remove = true;
      }

      // Unknown location
      if (!remove && removeUnknown && !hasKnownLocation(contact)) {
        remove = true;
      }

      contact.kept = !remove;
      updateMarkerIcon(index);
    });

    // Update radius circle size if it exists
    if (radiusCircle && rVal !== null) {
      radiusCircle.setRadius(rVal * 1000);
    }

    updateStats();
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------
  function updateStats() {
    var total = contacts.length;
    var keeping = 0;
    var removing = 0;
    contacts.forEach(function (c) {
      if (c.kept) keeping++;
      else removing++;
    });

    statsBar.innerHTML =
      "Total: " + total +
      " | Keeping: <span class='stat-keep'>" + keeping + "</span>" +
      " | Removing: <span class='stat-remove'>" + removing + "</span>";
  }

  // ---------------------------------------------------------------------------
  // Filter Event Listeners
  // ---------------------------------------------------------------------------
  filterRepeater.addEventListener("change", applyFilters);
  filterClient.addEventListener("change", applyFilters);
  filterRoom.addEventListener("change", applyFilters);

  radiusKm.addEventListener("input", function () {
    // Redraw the circle at the current center when radius changes
    var cLat = null, cLon = null;
    if (centerIndex !== null) {
      var contact = contacts[centerIndex];
      cLat = parseFloat(contact.latitude);
      cLon = parseFloat(contact.longitude);
    } else if (centerLatLon) {
      cLat = centerLatLon[0];
      cLon = centerLatLon[1];
    }
    if (cLat !== null && cLon !== null) {
      drawRadiusCircle(cLat, cLon);
    }
    applyFilters();
  });

  lastseenDays.addEventListener("input", applyFilters);
  flagsSelect.addEventListener("change", applyFilters);
  unknownRemove.addEventListener("change", applyFilters);
  unknownKeep.addEventListener("change", applyFilters);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------
  saveBtn.addEventListener("click", function () {
    var suggested = originalFilename || "contacts_filtered.json";
    saveFilename.value = suggested;
    saveModal.classList.add("visible");
  });

  modalCancelBtn.addEventListener("click", function () {
    saveModal.classList.remove("visible");
  });

  modalSaveBtn.addEventListener("click", function () {
    var keptContacts = contacts.filter(function (c) { return c.kept; }).map(stripClientState);
    var filename = saveFilename.value.trim() || "contacts_filtered.json";

    fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({
        contacts: keptContacts,
        filename: filename,
        original_filename: originalFilename
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          alert("Save failed: " + data.error);
          return;
        }
        alert("Saved " + data.count + " contacts to " + data.path);
        saveModal.classList.remove("visible");
      })
      .catch(function (err) {
        alert("Save failed: " + err.message);
      });
  });

  // ---------------------------------------------------------------------------
  // Export Removed
  // ---------------------------------------------------------------------------
  exportBtn.addEventListener("click", function () {
    var removedContacts = contacts.filter(function (c) { return !c.kept; }).map(stripClientState);

    fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({
        contacts: removedContacts,
        filename: "removed_contacts.json"
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.error) {
          alert("Export failed: " + data.error);
          return;
        }
        alert("Exported " + data.count + " removed contacts to " + data.path);
      })
      .catch(function (err) {
        alert("Export failed: " + err.message);
      });
  });

  // ---------------------------------------------------------------------------
  // Strip client-side state before sending to server
  // ---------------------------------------------------------------------------
  function stripClientState(contact) {
    var clean = {};
    Object.keys(contact).forEach(function (key) {
      if (key !== "kept" && key !== "manualOverride") {
        clean[key] = contact[key];
      }
    });
    return clean;
  }
});
