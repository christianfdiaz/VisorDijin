dojo.require("esri.map");
dojo.require("esri.geometry");
dojo.require("esri.dijit.Scalebar");
dojo.require("esri.dijit.Geocoder");
dojo.require("esri.dijit.BasemapGallery");
dojo.require("dijit.form.Button");
dojo.require("dojo.dom-attr");
dojo.require("esri.geometry.webMercatorUtils");
dojo.require("esri.tasks.locator");
dojo.require("esri.InfoTemplate");
dojo.require("dojo.number");
dojo.require("dojo.parser");
dojo.require("dijit.registry");
dojo.require("dojo.parser");
dojo.require("dijit.form.Slider");
dojo.require("esri.arcgis.utils");
dojo.require("dijit.Dialog");

//Global variables
var mapa, identifyTask, identifyParams;
var number, registry, strAddress;
var locator, templateLocator;
var latDelito, lonDelito, numCuadrante, ent_administrativa, barrio, cod_estacion, cod_cai;
var scaleBar;
var layerCuadrantes;
var geocodificador;
var strInformacion;
var mapPoint;


function init() {

    //setup the map
    mapa = new esri.Map("divMap", {
        basemap: "streets",
        center: [-73.461, 4.579],
        zoom: 5

    });

    var baseMapGallery = new esri.dijit.BasemapGallery({
        showArcGISBasemaps: true,
        map: mapa
    }, "divBaseMapGallery");

    baseMapGallery.startup();

    baseMapGallery.on("error", function (msg) {
        console.log("error en la galeria de mpas base: ", msg);
    });

    dojo.connect(mapa, "onLoad", mapReady);

    mapa.on("mouse-move", showCoordinates);
    scaleBar = new esri.dijit.Scalebar({
        map: mapa,
        scalebarUnit: "metric"
    });
    //esri.arcgis.utils.getItem("4778fee6371d4e83a22786029f30c7e1").then(function (response) {
    esri.arcgis.utils.getItem("4778fee6371d4e83a22786029f30c7e1").then(function (response) {
        dojo.map(response.itemData.operationalLayers, function (item) {
            var layerCuadrantes = new esri.layers.ArcGISDynamicMapServiceLayer(item.url, { opacity: item.opacity });
            mapa.addLayer(layerCuadrantes);
        });
        //console.log(response);
    });
    //layerCuadrantes = new esri.layers.ArcGISDynamicMapServiceLayer("http://srvsigmap.policia.gov.co/ArcGIS/rest/services/DIJIN/SIEDCO/MapServer",{opacity:.70});
    //mapa.addLayer(layerCuadrantes);

    statsLink = dojo.create("a", {
        "class": "action",
        "innerHTML": "Enviar Informaci\xf3n",
        "href": "javascript:void(0);"
    }, dojo.query(".actionsPane", mapa.infoWindow.domNode)[0]);

    dojo.connect(statsLink, "onclick", procesoInformacion);

    templateLocator = new esri.InfoTemplate('Direcci&oacute;n', '${Address}');

    //Geocodding on map 
    geocodificador = new esri.dijit.Geocoder({ map: mapa }, "divBuscar");
    geocodificador.autoComplete = true;
    geocodificador.startup();

    //Opacity bar
    barraTransparencia = new dijit.form.VerticalSlider({
        name: "divSliderBar",
        value: .50,
        minimum: 0,
        maximum: 1,
        intermediateChanges: true,
        style: "height:300px",
        onChange: function (value) {
            dojo.map(mapa.layerIds, function (item) {
                mapa.getLayer(item).opacity = value;
            });
        }
    }, "divSliderBar");

    if (dialog == null) {
        var dialogLoading = document.createElement("div");
        dialogLoading.innerHTML = "Espere por favor..";
        dialog = new dijit.Dialog({
            title: "Procesando informaci\xf3n....",
            content: dialogLoading,
            style: "width: 300px",
            id: 'dialogloading'
        });
    }
}
var dialog;
var address;
function procesoInformacion() {
    dialog.show();
    strAddress = "La Direcci&oacute; excede 10 mts de distancia a la intersecci&oacute;n vial m&aacute;s cercana."
    locator.locationToAddress(mapPoint, 10, direccionObtenida, errorDireccionObtenida);
}
function direccionObtenida(evt) {
    if (evt.address) {
        strAddress = evt.address.Address + " (+/- 10 mts)";
    }
    obtenerInformacionServicio();
}
function errorDireccionObtenida(evt) {
    obtenerInformacionServicio();
}
function obtenerInformacionServicio() {
    identifyParams.geometry = mapPoint;
    identifyParams.mapExtent = mapa.extent;
    var deferred = identifyTask.execute(identifyParams);
    deferred.addCallback(function (response) {
        // response is an array of identify result objects    
        // Let's return an array of features.
        dojo.map(response, function (result) {
            var feature = result.feature;
            feature.attributes.layerName = result.layerName;

            if (result.layerName === 'ADMIN_GEO.Municipios') {
                ent_administrativa = feature.attributes['Codigo Municipio'];
            }
            if (result.layerName === 'ADMIN_GEO.JurisdiccionesEstaciones') {
                cod_estacion = feature.attributes.CODIGO_SIEDCO;
                strInformacion = "&Cod_DANE=" + ent_administrativa + "&Cod_Estacion=" + cod_estacion + "&latitud=" + latDelito + "&longitud=" + lonDelito + "&direccion=" + strAddress;
            }
            if (result.layerName === 'ADMIN_GEO.Barrios') {
                barrio = feature.attributes['Nombre Barrio'];
            }
            if (result.layerName === 'cuadrantes') {
                numCuadrante = feature.attributes.CODIGO_SIEDCO;
                strInformacion = "&Cod_DANE=" + ent_administrativa + "&Cod_Estacion=" + cod_estacion + "&Barrio=" + barrio + "&Cuadrante=" + numCuadrante + "&latitud=" + latDelito + "&longitud=" + lonDelito + "&direccion=" + strAddress;
            }
        });
        dialog.hide();
        onButtonOKClick();
    });

}
function mapReady(map) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(centerMap, locationError);
    }
    dojo.connect(map, "onClick", executeIdentifyTask);
    identifyTask = new esri.tasks.IdentifyTask("http://srvsigmap.policia.gov.co/ArcGIS/rest/services/DIJIN/SIEDCO/MapServer");

    //Obtain address
    locator = new esri.tasks.Locator("http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer");
    identifyParams = new esri.tasks.IdentifyParameters();
    identifyParams.tolerance = 3;
    identifyParams.returnGeometry = false;
    identifyParams.layerIds = ["4,6,12,7,14"];
    identifyParams.layerOption = esri.tasks.IdentifyParameters.LAYER_OPTION_ALL;
    identifyParams.width = map.width;
    identifyParams.height = map.height;

}

//Function to center the map
function centerMap(position) {
    var point = esri.geometry.geographicToWebMercator(new esri.geometry.Point(position.coords.longitude, position.coords.latitude));
    mapa.centerAndZoom(point, 12);
}

//Error's handler function to location
function locationError(error) {
    switch (error.code) {
        case error.PERMISSION_DENEIED:
            alert("Ubicación sin porveer");
            break;

        case error.POSITION_UNAVAILABLE:
            alert("Ubicación actual no disponible");
            break;

        case error.TIMEOUT:
            alert("Límite de timepo alcanzado");
            break;

        case error.DEFAULT:
            alert("Error desconocido");
            break;
    }
}

//Function to get latitude, longitude, Cuadrante, DPTO, Municipio, address, etc
function executeIdentifyTask(evt) {
    mapPoint = evt.mapPoint;
    latDelito = evt.mapPoint.getLatitude();
    lonDelito = evt.mapPoint.getLongitude();
    makeMarker(lonDelito, latDelito);
    mapa.infoWindow.setTitle("Coordenadas");
    mapa.infoWindow.setContent("lat/lon : " + latDelito.toFixed(2) + ", " + lonDelito.toFixed(2));
    mapa.infoWindow.show(evt.mapPoint, mapa.getInfoWindowAnchor(evt.screenPoint));
    /*mapPoint = evt.mapPoint;
	identifyParams.geometry = mapPoint;
	identifyParams.mapExtent = mapa.extent;
	locator.locationToAddress(mapPoint,10,showAddress,showErrorAddress);
	
	var deferred = identifyTask.execute(identifyParams);
	latDelito = evt.mapPoint.getLatitude();
	lonDelito = evt.mapPoint.getLongitude();
	makeMarker(lonDelito,latDelito);
	
	deferred.addCallback(function(response) {     
    // response is an array of identify result objects    
    // Let's return an array of features.
    return dojo.map(response, function(result) {
      var feature = result.feature;
      feature.attributes.layerName = result.layerName;
      
      if(result.layerName === 'ADMIN_GEO.Departamentos'){
    	var template = new esri.InfoTemplate("Entidad Administrativa","Nombre Departamento: ${Nombre Departamento}<br/>Cod DANE: ${Codigo Departamento}<br/>" +
    			"<br/>Direcci&oacute;n: "+strAddress+"<br/>Latitud Delito: "+latDelito+"<br/>Longitud Delito:"+lonDelito+
    			"<br/><br/>Los datos fueron tomados del mapa, ahora puede hacer clic en el bot&oacute;n Enviar informaci&oacute;n.");
    	feature.setInfoTemplate(template);
      }
      else if(result.layerName === 'ADMIN_GEO.Municipios'){
        var template = new esri.InfoTemplate("Entidad Administrativa","Municipio: ${Nombre Municipio}<br/>Cod DANE: ${Codigo Municipio}<br/>" +
        		"Latitud Delito: "+latDelito+"<br/>Longitud Delito:"+lonDelito+
        		"<br/><br/>Los datos fueron tomados del mapa, ahora puede hacer clic en el bot&oacute;n Enviar informaci&oacute;n.");
        feature.setInfoTemplate(template);
        ent_administrativa = feature.attributes['Codigo Municipio'];
        
      }
      else if (result.layerName === 'ADMIN_GEO.JurisdiccionesEstaciones'){
    	  var template = new esri.InfoTemplate("Informaci&oacute;n Estaci&oacute;n","Cod SIEDCO: ${CODIGO_SIEDCO} <br/> Departamento: ${NOMBRE_DPTO} <br/> " +
    	  		"Nombre: ${ESTACION}<br/>Latitud Delito: "+latDelito+"<br/>Longitud Delito: "+lonDelito+
    	  		"<br/><br/>Los datos fueron tomados del mapa, ahora puede hacer clic en el bot&oacute;n Enviar informaci&oacute;n.");
    	  feature.setInfoTemplate(template);
    	  cod_estacion = feature.attributes.CODIGO_SIEDCO;
    	  strInformacion ="&Cod_DANE="+ent_administrativa+"&Cod_Estacion="+cod_estacion+"&latitud="+latDelito+"&longitud="+lonDelito+"&direccion="+strAddress;
      }
      else if (result.layerName === 'ADMIN_GEO.Barrios'){
    	  var template = new esri.InfoTemplate("Informaci&oacute;n Barrios","Nombre: ${Nombre Barrio} <br/>" +
    			  "Latitud Delito: "+latDelito+"<br/>Longitud Delito:"+lonDelito+
    			  "<br/><br/>Los datos fueron tomados del mapa, ahora puede hacer clic en el bot&oacute;n Enviar informaci&oacute;n.");
    	  feature.setInfoTemplate(template);
    	  barrio = feature.attributes['Nombre Barrio'];
      }
      else if (result.layerName === 'cuadrantes'){
    	  var template = new esri.InfoTemplate("Informaci&oacute;n Cuadrante","N&uacute;mero: ${NRO_CUADRANTE} <br/>" +
    	  		"C&oacute;digo_SIEDCO: ${CODIGO_SIEDCO}<br/>Latitud Delito: "+latDelito+"<br/>Longitud Delito: "+lonDelito+
    	  		"<br/><br/>Los datos fueron tomados del mapa, ahora puede hacer clic en el bot&oacute;n \"Enviar informaci&oacute;n.\"");
    	  feature.setInfoTemplate(template);
    	  numCuadrante = feature.attributes.CODIGO_SIEDCO;
    	  strInformacion ="&Cod_DANE="+ent_administrativa+"&Cod_Estacion="+cod_estacion+"&Barrio="+barrio+"&Cuadrante="+numCuadrante+"&latitud="+latDelito+"&longitud="+lonDelito+"&direccion="+strAddress;
      }
      return feature;
    });
    
  });

  // InfoWindow expects an array of features from each deferred
  // object that you pass. If the response from the task execution 
  // above is not an array of features, then you need to add a callback
  // like the one above to post-process the response and return an
  // array of features.
  mapa.infoWindow.setFeatures([ deferred ]);
  mapa.infoWindow.show(evt.mapPoint);
  dojo.byId('ButtonCoor').disabled= false;*/
}

function showAddress(evt) {
    if (evt.address) {
        strAddress = evt.address.Address + "(+/- 10 mts)";
    }

    return strAddress;
}

function showErrorAddress(err) {
    if (err) {
        strAddress = "La Direcci&oacute; excede 10 mts de distancia a la intersecci&oacute;n vial m&aacute;s cercana.";
    }
    return strAddress;
}

//Funtion to obtain parametres from URL
function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi,
    		function (m, key, value) {
    		    vars[key] = value;
    		});
    var s = '';
    console.log(parts);
    for (var propertyName in vars) {
        // propertyName is what you want
        // you can get the value like this: myObject[propertyName]    	
        s += propertyName + "=" + vars[propertyName] + "&";
    }
    return s;
}

//Function to show coordinates on map
function showCoordinates(event) {
    mapCoor = esri.geometry.webMercatorToGeographic(event.mapPoint);
    dojo.byId("spnCoordinates").innerHTML = "Lat: " + converCoor(mapCoor.y) + " , Lon: " + converCoor(mapCoor.x);
}

//Function to convert decimal to degree
function converCoor(coor) {
    var gg, mm, ss;
    if (coor < 0) {
        var absCoor = Math.abs(coor);
        gg = parseInt(absCoor, 10);
        mm = parseInt(((absCoor - gg) * 60), 10);
        ss = ((((absCoor - gg) * 60) - mm) * 60).toFixed(2);
        gg *= -1;
    } else {
        gg = parseInt(coor, 10);
        mm = parseInt(((coor - gg) * 60), 10);
        ss = ((((coor - gg) * 60) - mm) * 60).toFixed(2);
    }
    return (gg.toString() + '\xBA ' + mm.toString() + "\' " + ss.toString() + "\"");
}

//Function to obtain the coordenates from points
function makeMarker(lon, lat) {

    //code to disegner 
    var markPath = "M21.021,16.349c-0.611-1.104-1.359-1.998-2.109-2.623c-0.875,0.641-1.941,1.031-3.103,1.031c-1.164,0-2.231-" +
			"0.391-3.105-1.031c-0.75,0.625-1.498,1.519-2.111,2.623c-1.422,2.563-1.578,5.192-0.35,5.874c0.55,0.307,1.127,0.078,1.723-" +
			"0.496c-0.105,0.582-0.166,1.213-0.166,1.873c0,2.932,1.139,5.307,2.543,5.307c0.846,0,1.265-" +
			"0.865,1.466-2.189c0.201,1.324,0.62,2.189,1.463,2.189c1.406,0,2.545-2.375,2.545-5.307c0-0.66-0.061-1.291-0.168-" +
			"1.873c0.598,0.574,1.174,0.803,1.725,0.496C22.602,21.541,22.443,18.912,21.021,16.349zM15.808,13.757c2.362,0,4.278-1.916,4.278-" +
			"4.279s-1.916-4.279-4.278-4.279c-2.363,0-4.28,1.916-4.28,4.279S13.445,13.757,15.808,13.757z";
    var markColor = "0a9242";
    var point = new esri.geometry.Point({
        longitude: lon,
        latitude: lat
    });
    var mark = new esri.Graphic(point, createSymbol(markPath, markColor));
    mapa.graphics.add(mark);
}

//Function to create symbol on click
function createSymbol(path, color) {
    mapa.graphics.clear();
    var markerSymbol = new esri.symbol.SimpleMarkerSymbol();
    markerSymbol.setPath(path);
    markerSymbol.setColor(new dojo.Color(color));
    markerSymbol.setSize(23);
    markerSymbol.setOutline(null);
    return markerSymbol;
}

//Function to send the coordenates to new page
function onButtonOKClick() {
    //window.location="http://localhost:2020/delitos/formulario.html?"+strInformacion+"&"+getUrlVars();
    window.location = "!pag_hechos.html?" + strInformacion + "&" + getUrlVars();
}

//Function to load the visor
dojo.ready(init);
