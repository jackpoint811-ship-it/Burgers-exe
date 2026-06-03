import { deleteRaffleImage, uploadRaffleImage } from './_image';

export const onRequestPost: PagesFunction = (context) => uploadRaffleImage('detail', context);
export const onRequestDelete: PagesFunction = (context) => deleteRaffleImage('detail', context);
