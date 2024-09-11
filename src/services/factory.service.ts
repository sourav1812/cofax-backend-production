const factoryService = {
  Search: async (Modal: any, searchBy: string, value: string) => {
    const query: any = {};
    query[searchBy] = value;

    return await Modal.findOne(query);
  },
};

export default factoryService;
