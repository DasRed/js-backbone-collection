# backbone-collection
Provides more flexibility and functionality for backbone collections

- usage of Intl Comparator
- default sort order direction
- better URL Handling with parameters

## Install
```
bower install backbone-collection --save
npm install js-backbone-collection --save
```

## Options
### comparator
Defines the property name from the model to compare for sorting. If this values is not defined, the property name "id" will be used.

### direction
Defines the default sort order direction. Default value is "asc". Valid values are "asc" and "desc".

### fetched
Returns boolean true or false, if the collection was fetched from server or not.

### fetchSilentDefault
If a collection should be fetched form server and the fetch option "silent" is not defined, then will be taken this option value.

### isFetching
Returns true, if the collection is currently fetching the dara from server.

### resettable
Defines the collection as resetable. If this value is false, the reset function will not drop the models. New models will be appended.

### waitDefault
If a collection should create a model and the option "wait" is not defined, then will be taken this option value.
 
## Methods
### getFetch
This method will be fetch a model from the collection. If the model is not in the collection, a server request will be done. The request will be synchronous and the new model will be added to the collection and will be returned.
 
### getNext
This function will return the next model in list based on the given model. 

### getPrevious
This function will return the previous model in list based on the given model.
