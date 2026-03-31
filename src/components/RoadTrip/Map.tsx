import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, DirectionsRenderer, Marker, InfoWindow } from '@react-google-maps/api';

const containerStyle = {
  width: '100%',
  height: '100%'
};

const center = {
  lat: 41.9981,
  lng: 21.4254 // Skopje, Macedonia as default
};

interface MapProps {
  origin?: string;
  destination?: string;
  places?: google.maps.places.PlaceResult[];
  onRouteCalculated?: (result: google.maps.DirectionsResult) => void;
  isLoaded: boolean;
}

const Map: React.FC<MapProps> = ({ origin, destination, places = [], onRouteCalculated, isLoaded }) => {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null);

  const onLoad = useCallback(function callback() {
    // map instance not needed for now
  }, []);

  const onUnmount = useCallback(function callback() {
    // cleanup
  }, []);

  useEffect(() => {
    if (isLoaded && origin && destination) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: origin,
          destination: destination,
          travelMode: google.maps.TravelMode.DRIVING
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            setDirections(result);
            if (onRouteCalculated) {
              onRouteCalculated(result);
            }
          } else {
            console.error(`Error fetching directions: ${status}`);
          }
        }
      );
    }
  }, [isLoaded, origin, destination, onRouteCalculated]);

  if (!isLoaded) return <div className="h-full w-full flex items-center justify-center bg-slate-100 animate-pulse">Loading Map...</div>;

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={10}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={{
        styles: [
          {
            "featureType": "all",
            "elementType": "labels.text.fill",
            "stylers": [{ "color": "#141414" }]
          },
          {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{ "color": "#e9e9e9" }]
          }
        ],
        disableDefaultUI: false,
        zoomControl: true,
      }}
    >
      {directions && <DirectionsRenderer directions={directions} />}
      
      {places.map((place, index) => (
        <Marker
          key={index}
          position={place.geometry?.location}
          onClick={() => setSelectedPlace(place)}
          icon={{
            url: place.types?.includes('gas_station') ? 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png' : 
                 place.types?.includes('restaurant') ? 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png' : 
                 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
          }}
        />
      ))}

      {selectedPlace && selectedPlace.geometry?.location && (
        <InfoWindow
          position={selectedPlace.geometry.location}
          onCloseClick={() => setSelectedPlace(null)}
        >
          <div className="p-2 max-w-xs">
            <h3 className="font-bold text-sm">{selectedPlace.name}</h3>
            <p className="text-xs text-slate-500 mt-1">{selectedPlace.vicinity}</p>
            <div className="flex items-center gap-1 mt-2 text-xs font-medium text-blue-600">
              {selectedPlace.rating && <span>⭐ {selectedPlace.rating}</span>}
              {selectedPlace.price_level && <span>• {'$'.repeat(selectedPlace.price_level)}</span>}
            </div>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

export default Map;
